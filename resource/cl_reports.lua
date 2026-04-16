-- =============================================
-- cl_reports.lua — Client-side report system
-- =============================================

-- =============================================
-- MARK: Report NUI communication
-- =============================================

--- Open the report UI
local isReportOpen = false

RegisterCommand('report', function()
    if not GetConvarBool('txAdmin-reportsEnabled') then
        return
    end
    if isReportOpen then
        return
    end
    isReportOpen = true

    -- Open the NUI immediately so the player sees the panel
    SetNuiFocus(true, true)
    SendMenuMessage('openReportUI', { players = {} })

    -- Then fetch data from server (player list + tickets)
    TriggerServerEvent('txsv:reportOpen')
end, false)

--- Close report UI callback
RegisterSecureNuiCallback('reportClose', function(data, cb)
    isReportOpen = false
    SetNuiFocus(false, false)
    cb({})
end)

--- Submit new report callback
RegisterSecureNuiCallback('reportSubmit', function(data, cb)
    TriggerServerEvent('txsv:reportCreate', data)
    cb({})
end)

--- Reports tab opened — fetch player list + reports inline
RegisterSecureNuiCallback('reportTabOpen', function(data, cb)
    TriggerServerEvent('txsv:reportTabOpen')
    cb({})
end)

--- Fetch my reports callback
RegisterSecureNuiCallback('reportFetchMine', function(data, cb)
    TriggerServerEvent('txsv:reportGetMine')
    cb({})
end)

--- Send message on a report callback
RegisterSecureNuiCallback('reportSendMessage', function(data, cb)
    TriggerServerEvent('txsv:reportPlayerMessage', data)
    cb({})
end)

-- =============================================
-- MARK: Server → Client events
-- =============================================

--- Receive report open data (players + tickets)
RegisterNetEvent('txcl:reportOpenData', function(data)
    SendMenuMessage('openReportUI', {
        players = data.players or {},
    })
    SendMenuMessage('reportMyList', {
        reports = data.reports or {},
    })
end)

--- Receive report creation result
RegisterNetEvent('txcl:reportResult', function(data)
    SendMenuMessage('reportCreateResult', data)
end)

--- Receive reports tab data (players + reports for inline tab)
RegisterNetEvent('txcl:reportTabData', function(data)
    SendMenuMessage('reportTabData', data)
end)

--- Receive player's report list (standalone refresh)
RegisterNetEvent('txcl:reportMyList', function(data)
    SendMenuMessage('reportMyList', data)
end)

--- Receive message send result
RegisterNetEvent('txcl:reportMessageResult', function(data)
    SendMenuMessage('reportMessageResult', data)
end)

--- Receive admin notification about new report
RegisterNetEvent('txcl:reportNotification', function(data)
    SendMenuMessage('reportNotification', data)
end)


-- =============================================
-- MARK: Admin report management (in-game NUI panel)
-- =============================================

--- Admin: fetch all reports
RegisterSecureNuiCallback('reportAdminList', function(data, cb)
    TriggerServerEvent('txsv:reportAdminList')
    cb({})
end)

--- Admin: fetch report detail
RegisterSecureNuiCallback('reportAdminDetail', function(data, cb)
    TriggerServerEvent('txsv:reportAdminDetail', data.reportId)
    cb({})
end)

--- Admin: send message to a report
RegisterSecureNuiCallback('reportAdminMessage', function(data, cb)
    TriggerServerEvent('txsv:reportAdminMessage', {
        reportId = data.reportId,
        content = data.content,
    })
    cb({})
end)

--- Admin: change report status
RegisterSecureNuiCallback('reportAdminStatus', function(data, cb)
    TriggerServerEvent('txsv:reportAdminStatus', {
        reportId = data.reportId,
        status = data.status,
    })
    cb({})
end)

--- Receive admin report list
RegisterNetEvent('txcl:reportAdminListData', function(data)
    SendMenuMessage('reportAdminListData', data)
end)

--- Receive admin report detail
RegisterNetEvent('txcl:reportAdminDetailData', function(data)
    SendMenuMessage('reportAdminDetailData', data)
end)

--- Receive admin message result
RegisterNetEvent('txcl:reportAdminMessageResult', function(data)
    SendMenuMessage('reportAdminMessageResult', data)
end)

--- Receive admin status change result
RegisterNetEvent('txcl:reportAdminStatusResult', function(data)
    SendMenuMessage('reportAdminStatusResult', data)
end)
