using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using PrivateChat.API.Data;
using PrivateChat.API.Models;

namespace PrivateChat.API.Hubs;

[Authorize]
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

    public async Task SendMessage(
        Guid messageId,
        string text)
    {
        text = (text ?? string.Empty).Trim();

        if (messageId == Guid.Empty)
            throw new HubException("Message ID is required.");

        if (string.IsNullOrWhiteSpace(text))
            return;

        if (text.Length > 4000)
            throw new HubException("Message is too long.");

        var senderName =
            Context.User?.FindFirstValue(ClaimTypes.Name);

        if (string.IsNullOrWhiteSpace(senderName))
        {
            throw new HubException(
                "Authenticated username could not be determined.");
        }

        var existingMessage = await _db.Messages
            .AsNoTracking()
            .FirstOrDefaultAsync(x =>
                x.MessageId == messageId);

        if (existingMessage != null)
        {
            return;
        }

        var message = new ChatMessage
        {
            MessageId = messageId,
            RoomId = RoomId,
            SenderName = senderName,
            Text = text,
            SentAtUtc = DateTime.UtcNow
        };

        _db.Messages.Add(message);

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            var duplicate = await _db.Messages
                .AsNoTracking()
                .AnyAsync(x =>
                    x.MessageId == messageId);

            if (!duplicate)
                throw;

            return;
        }

        await Clients.Group(RoomId)
            .SendAsync(
                "ReceiveMessage",
                message);
    }

    public override async Task OnConnectedAsync()
    {
        await Groups.AddToGroupAsync(
            Context.ConnectionId,
            RoomId);

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(
        Exception? exception)
    {
        await Groups.RemoveFromGroupAsync(
            Context.ConnectionId,
            RoomId);

        await base.OnDisconnectedAsync(exception);
    }
}