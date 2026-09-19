using Microsoft.EntityFrameworkCore;
using PrivateChat.API.Data;
using PrivateChat.API.Hubs;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<ChatDbContext>(options =>
    options.UseSqlite(
        builder.Configuration.GetConnectionString("ChatDatabase")
        ?? "Data Source=Data/privatechat.db"));

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

Directory.CreateDirectory(Path.Combine(app.Environment.ContentRootPath, "Data"));

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ChatDbContext>();
    db.Database.EnsureCreated();
}

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
