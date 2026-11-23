// Packages a .NET application into a gzip-compressed .t57 tarball for deployment.
// This script is used by the /pack skill to produce a single deployable artifact containing the
// project source, the solution's docs folder (if present), any API spec the project's NSwag configurations
// read from elsewhere in the repository, and a Dockerfile that builds the app into a Docker image.
//
// Usage:
//   dotnet run pack.cs -- <csproj-file-path>

using System.Formats.Tar;
using System.IO.Compression;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

const string DockerfileTemplateRelativePath = "dockerfile-template";

if (!TryParseArgs(args, out string csprojFilePath, out string? errorMessage))
{
    Console.Error.WriteLine("Usage: dotnet run pack.cs -- <csproj-file-path>");
    Console.Error.WriteLine("Argument error: " + errorMessage);
    return 1;
}

try
{
    string fullCsprojFilePath = Path.GetFullPath(csprojFilePath);
    string projectFolderPath = Path.GetDirectoryName(fullCsprojFilePath)!;

    if (!File.Exists(Path.Combine(projectFolderPath, "Program.cs")))
    {
        throw new FailException($"No Program.cs found in project folder '{projectFolderPath}'. /pack expects the main application project.");
    }

    string templateFilePath = Path.Combine(ScriptFolderPath(), DockerfileTemplateRelativePath);
    if (!File.Exists(templateFilePath))
    {
        throw new FailException($"Dockerfile template not found at '{templateFilePath}'.");
    }

    string projectName = Path.GetFileNameWithoutExtension(fullCsprojFilePath);
    string solutionFolderPath = FindSolutionFolder(projectFolderPath);
    string artifactsFolderPath = Path.Combine(solutionFolderPath, "artifacts");
    string packageFilePath = Path.Combine(artifactsFolderPath, $"{projectName}.t57");
    string docsFolderPath = Path.Combine(solutionFolderPath, "docs");
    SortedDictionary<string, string> apiSpecFilePathsByEntryName = FindApiSpecsOutsidePackagedFolders(projectFolderPath, docsFolderPath, solutionFolderPath);

    Directory.CreateDirectory(artifactsFolderPath);

    using (FileStream fileStream = File.Create(packageFilePath))
    using (var gzipStream = new GZipStream(fileStream, CompressionLevel.Optimal))
    using (var tarWriter = new TarWriter(gzipStream, TarEntryFormat.Pax))
    {
        PackDockerfile(tarWriter, projectName, templateFilePath, apiSpecFilePathsByEntryName.Keys);

        if (Directory.Exists(docsFolderPath))
        {
            PackFolder(tarWriter, docsFolderPath, "src/docs", excludeBinAndObj: false, excludeGenerated: true);
        }

        PackFolder(tarWriter, projectFolderPath, $"src/{projectName}", excludeBinAndObj: true, excludeGenerated: true);

        foreach ((string entryName, string apiSpecFilePath) in apiSpecFilePathsByEntryName)
        {
            tarWriter.WriteEntry(apiSpecFilePath, entryName);
        }
    }

    var summary = new JsonObject
    {
        ["packageFilePath"] = packageFilePath,
        ["projectName"] = projectName,
    };
    Console.WriteLine(summary.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
    return 0;
}
catch (FailException exception)
{
    Console.Error.WriteLine($"ERROR: {exception.Message}");
    return 1;
}

static bool TryParseArgs(string[] args, out string csprojFilePath, out string? errorMessage)
{
    csprojFilePath = args.ElementAtOrDefault(0) ?? "";

    if (string.IsNullOrEmpty(csprojFilePath))
    {
        errorMessage = "No csproj file path provided.";
        return false;
    }
    if (!csprojFilePath.EndsWith(".csproj", StringComparison.OrdinalIgnoreCase))
    {
        errorMessage = $"Project file '{csprojFilePath}' is not a .csproj file.";
        return false;
    }
    if (!File.Exists(csprojFilePath))
    {
        errorMessage = $"Project file '{csprojFilePath}' not found.";
        return false;
    }

    errorMessage = null;
    return true;
}

static string FindSolutionFolder(string projectFolderPath)
{
    for (DirectoryInfo? directoryInfo = new(projectFolderPath); directoryInfo is not null; directoryInfo = directoryInfo.Parent)
    {
        if (directoryInfo.EnumerateFiles().Any(file => file.Extension is ".sln" or ".slnx"))
        {
            return directoryInfo.FullName;
        }
    }
    throw new FailException($"No solution (.sln/.slnx) found above '{projectFolderPath}'. /pack anchors the docs and artifacts folders at the solution root.");
}

static SortedDictionary<string, string> FindApiSpecsOutsidePackagedFolders(string projectFolderPath, string docsFolderPath, string solutionFolderPath)
{
    var apiSpecFilePathsByEntryName = new SortedDictionary<string, string>(StringComparer.Ordinal);

    string nswagFolderPath = Path.Combine(projectFolderPath, "NSwag");
    if (!Directory.Exists(nswagFolderPath))
    {
        return apiSpecFilePathsByEntryName;
    }

    foreach (string nswagFilePath in Directory.EnumerateFiles(nswagFolderPath, "*.nswag"))
    {
        if (ReadApiSpecFilePath(nswagFilePath) is not { } apiSpecFilePath
            || IsInFolder(apiSpecFilePath, projectFolderPath)
            || IsInFolder(apiSpecFilePath, docsFolderPath))
        {
            continue;
        }

        apiSpecFilePathsByEntryName[PackageEntryName(apiSpecFilePath, nswagFilePath, solutionFolderPath)] = apiSpecFilePath;
    }

    return apiSpecFilePathsByEntryName;
}

static string? ReadApiSpecFilePath(string nswagFilePath)
{
    JsonNode? nswagConfiguration;
    try
    {
        nswagConfiguration = JsonNode.Parse(
            File.ReadAllText(nswagFilePath),
            documentOptions: new JsonDocumentOptions { CommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true });
    }
    catch (JsonException exception)
    {
        throw new FailException($"NSwag configuration '{nswagFilePath}' is not valid JSON: {exception.Message}");
    }

    if (nswagConfiguration?["documentGenerator"]?["fromDocument"]?["json"] is not JsonValue documentSourceValue
        || !documentSourceValue.TryGetValue(out string? documentSource))
    {
        return null;
    }

    // The source can also be a URL or the document itself, and a missing file is left for the build to report.
    string apiSpecFilePath = Path.GetFullPath(Path.Combine(Path.GetDirectoryName(nswagFilePath)!, documentSource));
    return File.Exists(apiSpecFilePath) ? apiSpecFilePath : null;
}

// The package mirrors the repository with the solution folder renamed to src, so the relative spec paths
// in the NSwag configurations resolve the same way in the package as they do in the repository.
static string PackageEntryName(string apiSpecFilePath, string nswagFilePath, string solutionFolderPath)
{
    if (IsInFolder(apiSpecFilePath, solutionFolderPath))
    {
        return "src/" + ToEntryPath(Path.GetRelativePath(solutionFolderPath, apiSpecFilePath));
    }

    string? repositoryFolderPath = Path.GetDirectoryName(solutionFolderPath);
    if (repositoryFolderPath is null || !IsInFolder(apiSpecFilePath, repositoryFolderPath))
    {
        throw new FailException($"NSwag configuration '{nswagFilePath}' reads the API spec '{apiSpecFilePath}', which is outside the repository. /pack can only package an API spec that is inside the repository.");
    }

    return ToEntryPath(Path.GetRelativePath(repositoryFolderPath, apiSpecFilePath));
}

static bool IsInFolder(string path, string folderPath)
{
    string relativePath = Path.GetRelativePath(folderPath, path);
    return !Path.IsPathRooted(relativePath)
        && relativePath != ".."
        && !relativePath.StartsWith(".." + Path.DirectorySeparatorChar);
}

static string ToEntryPath(string relativePath) => relativePath.Replace(Path.DirectorySeparatorChar, '/');

static void PackDockerfile(TarWriter tarWriter, string projectName, string templateFilePath, IEnumerable<string> apiSpecEntryNames)
{
    IEnumerable<string> topLevelEntryNames = apiSpecEntryNames
        .Select(entryName => entryName.Split('/')[0])
        .Prepend("src")
        .Distinct();

    string dockerfileContent = Render(File.ReadAllText(templateFilePath), new Dictionary<string, string>
    {
        ["projectName"] = projectName,
        ["copyPackageContents"] = string.Join("\n", topLevelEntryNames.Select(entryName => $"COPY [\"{entryName}\", \"{entryName}\"]")),
    }).Replace("\r\n", "\n");

    using var memoryStream = new MemoryStream(Encoding.UTF8.GetBytes(dockerfileContent));
    tarWriter.WriteEntry(new PaxTarEntry(TarEntryType.RegularFile, "Dockerfile")
    {
        DataStream = memoryStream,
    });
}

static void PackFolder(TarWriter tarWriter, string sourceFolderPath, string entryPrefix, bool excludeBinAndObj, bool excludeGenerated)
{
    tarWriter.WriteEntry(new PaxTarEntry(TarEntryType.Directory, entryPrefix.TrimEnd('/') + "/"));

    foreach (string filePath in Directory.EnumerateFiles(sourceFolderPath))
    {
        if (excludeGenerated && filePath.EndsWith(".g.cs", StringComparison.OrdinalIgnoreCase)) continue;
        tarWriter.WriteEntry(filePath, $"{entryPrefix}/{Path.GetFileName(filePath)}");
    }

    foreach (string folderPath in Directory.EnumerateDirectories(sourceFolderPath))
    {
        string folderName = Path.GetFileName(folderPath);
        if (excludeBinAndObj && (folderName.Equals("bin", StringComparison.OrdinalIgnoreCase)
                             || folderName.Equals("obj", StringComparison.OrdinalIgnoreCase))) continue;
        PackFolder(tarWriter, folderPath, $"{entryPrefix}/{folderName}", excludeBinAndObj, excludeGenerated);
    }
}

static string Render(string template, Dictionary<string, string> values)
{
    return Regex.Replace(template, @"\{\{(\w+)\}\}", match =>
    {
        string key = match.Groups[1].Value;
        if (!values.TryGetValue(key, out string? value))
        {
            throw new FailException($"Template references unknown placeholder '{{{{{key}}}}}'.");
        }
        return value;
    });
}

// [CallerFilePath] resolves at compile time to the absolute path of this source file.
// AppContext.BaseDirectory would point at the file-based app build cache.
static string ScriptFolderPath([CallerFilePath] string path = "") => Path.GetDirectoryName(Path.GetFullPath(path))!;

internal sealed class FailException(string message) : Exception(message);
