-- =============================================
--  Live spectate streaming (WebGL capture relay)
-- =============================================
local activeSessionId = nil
local frameLogCount = 0

--- Start live capture on this client
RegisterNetEvent('txcl:spectate:stream:start', function(sessionId)
    if type(sessionId) ~= 'string' then return end
    activeSessionId = sessionId
    frameLogCount = 0

    SendNUIMessage({
        action = 'startCapture',
        data = {
            sessionId = sessionId,
            fps = 5,
            quality = 0.4,
            resolutionScale = 0.5,
        },
    })
end)

--- Stop live capture on this client
RegisterNetEvent('txcl:spectate:stream:stop', function(sessionId)
    if type(sessionId) ~= 'string' then return end
    activeSessionId = nil
    SendNUIMessage({
        action = 'stopCapture',
        data = {},
    })
end)

--- Receives captured frames from the NUI and relays to the server
RegisterRawNuiCallback('spectateFrame', function(req, cb)
    cb({ status = 200, body = '{}' })
    if not activeSessionId then
        return
    end

    local body = json.decode(req.body)
    if not body or type(body.frameData) ~= 'string' then
        return
    end

    frameLogCount = frameLogCount + 1

    -- Use latent event for large frame payloads (2 MB/s rate)
    TriggerLatentServerEvent('txsv:spectate:frame', 2000000, activeSessionId, body.frameData)
end)

--- Cleanup on resource stop
AddEventHandler('onResourceStop', function(resName)
    if resName ~= GetCurrentResourceName() then return end
    if activeSessionId then
        activeSessionId = nil
        SendNUIMessage({ action = 'stopCapture', data = {} })
    end
end)
