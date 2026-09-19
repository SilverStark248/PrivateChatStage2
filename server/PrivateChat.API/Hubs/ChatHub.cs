using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using PrivateChat.API.Data;
using PrivateChat.API.Models;

namespace PrivateChat.API.Hubs;

public class ChatHub : Hub
{
    private const string RoomId = "our-private-room";

    private readonly ChatDbContext _db;

    public ChatHub(ChatDbContext db)
    {
        _db = db;
    }

    public async Task<List<ChatMessage>> GetHistory(int limit = 100)
    {
        limit = Math.Clamp(limit, 1, 200);

        return await _db.Messages
            .Where(x => x.RoomId == RoomId)
            .OrderByDescending(x => x.SentAtUtc)
            .Take(limit)
            .OrderBy(x => x.SentAtUtc)
            .AsNoTracking()
            .ToListAsync();
    }

    public async Task SendMessage(string senderName, string text)
    {
        senderName = (senderName ?? string.Empty).Trim();
        text = (text ?? string.Empty).Trim();

        if (string.IsNullOrWhiteSpace(senderName))
            throw new HubException("A sender name is required.");

        if (string.IsNullOrWhiteSpace(text))
            return;

        if (senderName.Length > 50)
            throw new HubException("Sender name is too long.");

        if (text.Length > 4000)
            throw new HubException("Message is too long.");

        var message = new ChatMessage
        {
            MessageId = Guid.NewGuid(),
            RoomId = RoomId,
            SenderName = senderName,
            Text = text,
            SentAtUtc = DateTime.UtcNow
        };

        _db.Messages.Add(message);
        await _db.SaveChangesAsync();

        await Clients.Group(RoomId).SendAsync("ReceiveMessage", message);
    }

    public override async Task OnConnectedAsync()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, RoomId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, RoomId);
        await base.OnDisconnectedAsync(exception);
    }
}
