using Microsoft.EntityFrameworkCore;
using PrivateChat.API.Data;
using PrivateChat.API.Hubs;

var builder = WebApplication.CreateBuilder(args);

var connectionString = Environment.GetEnvironmentVariable("DATABASE_URL");

if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "DATABASE_URL environment variable is not configured.");
}

builder.Services.AddDbContext<ChatDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddSignalR();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:5173",
                "https://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddControllers();

var app = builder.Build();

app.UseCors("Frontend");

app.MapGet("/", () => Results.Ok(new
{
    name = "PrivateChat API",
    stage = 1,
    status = "running"
}));

app.MapControllers();

app.MapHub<ChatHub>("/chatHub");

app.Run();