FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["server/PrivateChat.API/PrivateChat.API.csproj", "server/PrivateChat.API/"]
RUN dotnet restore "server/PrivateChat.API/PrivateChat.API.csproj"

COPY . .
WORKDIR "/src/server/PrivateChat.API"
RUN dotnet publish "PrivateChat.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://0.0.0.0:10000
EXPOSE 10000

ENTRYPOINT ["dotnet", "PrivateChat.API.dll"]
