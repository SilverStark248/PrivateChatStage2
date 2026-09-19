namespace PrivateChat.API.Models;

public class ChatMessage
{
    public int Id { get; set; }

    public Guid MessageId { get; set; } = Guid.NewGuid();

    public string RoomId { get; set; } = "our-private-room";

    public string SenderName { get; set; } = string.Empty;

    public string Text { get; set; } = string.Empty;

    public DateTime SentAtUtc { get; set; } = DateTime.UtcNow;
}
