using Twenty57.Builder.ApplicationRuntime.Interfaces;
using Twenty57.Builder.ApplicationRuntime.Sdk;
using MyApp;

var builder = Host.CreateApplicationBuilder();

var appSettings = builder.Configuration.Get<AppSettings>()!;
builder.Services.AddSingleton<IAppSettings>(appSettings);
builder.Services.AddSingleton(appSettings);

builder.Services.AddHostedService<Application>();

await Runner.RunAsync(builder.Build()).ConfigureAwait(false);
