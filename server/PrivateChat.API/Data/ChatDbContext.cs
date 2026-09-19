using Microsoft.EntityFrameworkCore;
using PrivateChat.API.Models;

namespace PrivateChat.API.Data;

public class ChatDbContext : DbContext
{
    public ChatDbContext(DbContextOptions<ChatDbContext> options)
        : base(options)
    {
    }

    public DbSet<ChatMessage> Messages => Set<ChatMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ChatMessage>()
            .HasIndex(x => x.MessageId)
            .IsUnique();

        modelBuilder.Entity<ChatMessage>()
            .HasIndex(x => new { x.RoomId, x.SentAtUtc });
    }
}
