"use strict";
/// <reference path="../csgo.d.ts" />
/// <reference path="../avatar.ts" />
/// <reference path="../digitpanel.ts" />
/// <reference path="../particle_controls.ts" />
/// <reference path="../common/formattext.ts" />
/// <reference path="../common/scheduler.ts" />
/// <reference path="../common/teamcolor.ts" />
/// <reference path="../hud/hudwinpanel_background_map.ts" />
var HudWinPanel;
(function (HudWinPanel) {
    let _m_elCanvas;
    let _m_elPlotContainer;
    let _m_canvasHeightInPixels;
    let _m_canvasWidthInPixels;
    let _m_teamPerspective;
    let _m_localXuid;
    let _m_timeslice;
    let _m_bInit = false;
    let _m_xRange;
    let _m_prevChance;
    let _m_ListeningForGameEvents = false;
    let _m_bCanvasIsReady = false;
    let _m_arrTimelineEvents = [];
    let _m_arrPersonalDamageEvents = [];
    let _m_winningTeam;
    const TOTAL_TIME_REVEAL = 5;
    const BEAM_ONLY_ON_DAMAGE = false;
    function _Init() {
        if (_m_bInit)
            return;
        $.RegisterForUnhandledEvent('HudWinPanel_ShowRoundEndReport', _ShowRoundEndReport);
        $.RegisterForUnhandledEvent('Player_Hurt', _OnReceivePlayerHurt);
        $.RegisterForUnhandledEvent('Player_Death', _OnReceivePlayerDeath);
        _m_bInit = true;
    }
    function _SetMVP(xuid, reason, team) {
        const avatar = $("#MVPAvatar");
        avatar.PopulateFromPlayerSlot(GameStateAPI.GetPlayerSlot(xuid));
        avatar.SetHasClass("team--TERRORIST", team === 2);
        avatar.SetHasClass("team--CT", team === 3);
        $.GetContextPanel().SetDialogVariableInt('player_slot', GameStateAPI.GetPlayerSlot(xuid));
        let sMvpReasonToken = "#Panorama_winpanel_mvp_award";
        let elMapContainer = $.GetContextPanel().FindChildInLayoutFile('id-match-mvp-map-container');
        MvpBackgroundMap.SetUpMapWinPanel(xuid, reason, team, elMapContainer);
        switch (reason) {
            case 1:
                sMvpReasonToken = "#Panorama_winpanel_mvp_award_kills";
                break;
            case 2:
                sMvpReasonToken = "#Panorama_winpanel_mvp_award_bombplant";
                break;
            case 3:
                sMvpReasonToken = "#Panorama_winpanel_mvp_award_bombdefuse";
                break;
            case 4:
                sMvpReasonToken = "#Panorama_winpanel_mvp_award_rescue";
                break;
            case 5:
                sMvpReasonToken = "#Panorama_winpanel_mvp_award_gungame";
                break;
            case 7:
                sMvpReasonToken = "#Panorama_winpanel_mvp_winner";
                break;
            case 9:
                sMvpReasonToken = "#Panorama_winpanel_mvp_award_ace";
                break;
            case 10:
                sMvpReasonToken = "#Panorama_winpanel_mvp_award_inferno";
                break;
            case 11:
                sMvpReasonToken = "#Panorama_winpanel_mvp_award_blast";
                break;
            case 12:
                sMvpReasonToken = "#Panorama_winpanel_mvp_winner";
                break;
            case 13:
                sMvpReasonToken = "#Panorama_winpanel_mvp_award_bombplant_clutch";
                break;
            case 14:
                sMvpReasonToken = "#Panorama_winpanel_mvp_award_bombdefuse_clutch";
                break;
            case 15:
                sMvpReasonToken = "#Panorama_winpanel_mvp_award_kills_three";
                break;
            case 16:
                sMvpReasonToken = "#Panorama_winpanel_mvp_award_kills_four";
                break;
        }
        $.GetContextPanel().SetDialogVariable("mvp_name_and_reason", $.Localize(sMvpReasonToken, $.GetContextPanel()));
        const jsHonorIcon = $("#jsHonorIcon");
        $.DispatchEvent("HonorIcon_SetOptions", jsHonorIcon, jsHonorIcon, true, GameStateAPI.GetPlayerXpTrailLevel(xuid), false);
    }
    function _OnReceivePlayerHurt(attackerXuid, victimXuid, damage) {
        if (!_m_ListeningForGameEvents)
            return;
        if (!_m_bCanvasIsReady) {
            $.Schedule(0.5, () => _OnReceivePlayerHurt(attackerXuid, victimXuid, damage));
            return;
        }
        if (_m_localXuid != attackerXuid && _m_localXuid != victimXuid)
            return;
        const wasDamageGiven = _m_localXuid == attackerXuid;
        const healthRemoved = wasDamageGiven ? damage : 0;
        const numHits = wasDamageGiven ? 1 : 0;
        const returnedHealthRemoved = wasDamageGiven ? 0 : damage;
        const returnHits = wasDamageGiven ? 0 : 1;
        _UpdateDamage(wasDamageGiven ? victimXuid : attackerXuid, healthRemoved, numHits, returnedHealthRemoved, returnHits);
    }
    function _OnReceivePlayerDeath(xuid) {
        if (!_m_ListeningForGameEvents)
            return;
        if (!_m_bCanvasIsReady) {
            $.Schedule(0.5, () => _OnReceivePlayerDeath(xuid));
            return;
        }
        const elEvent = $.GetContextPanel().FindChildTraverse('Event-' + xuid);
        if (!elEvent)
            return;
        const elDeath = elEvent.FindChildTraverse('Death');
        if (!elDeath)
            return;
        elDeath.visible = true;
    }
    function _TransformPointIntoCanvasSpace(point) {
        const denom = _m_xRange;
        const x = _m_canvasWidthInPixels / denom * point[0];
        const y = _m_canvasHeightInPixels - (_m_canvasHeightInPixels / 100 * point[1]);
        return [x, y];
    }
    function _FlipY(plotPoint) {
        return [plotPoint[0], _m_canvasHeightInPixels - plotPoint[1]];
    }
    function _ConvertToLocalOdds(terroristOdds) {
        if (_m_teamPerspective == 2)
            return terroristOdds;
        else
            return (100 - terroristOdds);
    }
    function _ShowRoundEndReport(msg) {
        if (!msg)
            return;
        _Reset();
        _m_ListeningForGameEvents = true;
        if (!_m_elCanvas.IsSizeValid()) {
            $.Schedule(0.5, () => _ShowRoundEndReport.bind(msg));
            return;
        }
        _m_bCanvasIsReady = true;
        $.GetContextPanel().SetDialogVariable('player_name', GameStateAPI.GetPlayerName(_m_localXuid));
        _m_canvasHeightInPixels = _m_elCanvas.actuallayoutheight / _m_elCanvas.actualuiscale_y;
        _m_canvasWidthInPixels = _m_elCanvas.actuallayoutwidth / _m_elCanvas.actualuiscale_x;
        const oInitialConditions = msg.init_conditions;
        const nStartingOdds = oInitialConditions.terrorist_odds;
        const arrEvents = msg.all_rer_event_data;
        _m_arrTimelineEvents = _ExtractTimelineEvents(arrEvents);
        _m_arrPersonalDamageEvents = _ExtractLivingEnemies(arrEvents);
        _m_winningTeam = '';
        if (_m_arrTimelineEvents.length > 0) {
            const FinalTOdds = _m_arrTimelineEvents[_m_arrTimelineEvents.length - 1]['terrorist_odds'];
            _m_winningTeam = FinalTOdds == 100 ? 2 : FinalTOdds == 0 ? 3 : '';
        }
        _m_xRange = _m_arrTimelineEvents.length + _m_arrPersonalDamageEvents.length + 1.5;
        _m_timeslice = TOTAL_TIME_REVEAL / _m_xRange;
        const x = 0;
        const y = _ConvertToLocalOdds(nStartingOdds);
        const startPoint = [x, y];
        const startPlotPoint = _TransformPointIntoCanvasSpace(startPoint);
        const points = [];
        points.push(startPoint);
        const plotPoints = [];
        plotPoints.push(startPlotPoint);
        _PlotStartingOdds(nStartingOdds, startPlotPoint);
        _ProcessTimelineEvents(_m_arrTimelineEvents, points, plotPoints, nStartingOdds);
        const finalPoint = points[points.length - 1];
        _ProcessDamageEvents(_m_arrPersonalDamageEvents, finalPoint[0]);
        const bCT = _m_teamPerspective == 3;
        const drawColor = bCT ? '#B5D4EEaa' : '#EAD18Aaa';
        _m_elCanvas.DrawSoftLinePointsJS(plotPoints.length, plotPoints.flat(), 4, 1.0, drawColor);
        _m_elCanvas.TriggerClass('show-canvas');
        const graphWidth = (_m_arrTimelineEvents.length) / _m_xRange * 100;
        const elGraphGuides = $.GetContextPanel().FindChildTraverse('GraphGuides');
        elGraphGuides.style.width = graphWidth + "%";
        const elLivingBG = $.GetContextPanel().FindChildTraverse('LivingBG');
        elLivingBG.style.width = 100 - graphWidth + "%";
        _Colorize();
        const freezetime = Number(GameInterfaceAPI.GetSettingString('mp_freezetime'));
        const roundRestartDelay = Number(GameInterfaceAPI.GetSettingString('mp_round_restart_delay'));
        const shutdownDelay = roundRestartDelay + freezetime - 1;
        Scheduler.Schedule(shutdownDelay, () => {
            _m_ListeningForGameEvents = false;
            _m_bCanvasIsReady = false;
        });
    }
    function _ExtractTimelineEvents(arrEvents) {
        const arrResults = [];
        for (let oEvent of arrEvents) {
            const oVictimData = oEvent['victim_data'];
            const isLivingPlayer = oVictimData && !oVictimData['is_dead'];
            if (!isLivingPlayer)
                arrResults.push(oEvent);
        }
        return arrResults;
    }
    function _ExtractLivingEnemies(arrEvents) {
        const arrResults = [];
        for (let oEvent of arrEvents) {
            const oVictimData = oEvent['victim_data'];
            const isLivingPlayer = oVictimData && !oVictimData['is_dead'];
            const localTeam = GameStateAPI.GetAssociatedTeamNumber(_m_localXuid);
            const isEnemy = oVictimData && oVictimData['team_number'] != localTeam && (localTeam == 2 || localTeam == 3);
            if (isLivingPlayer && isEnemy)
                arrResults.push(oEvent);
        }
        return arrResults;
    }
    function _ProcessTimelineEvents(arrEvents, points, plotPoints, nStartingOdds) {
        let loopingSfxHandle = null;
        for (let index = 0; index < arrEvents.length; ++index) {
            const oEvent = arrEvents[index];
            const x = index + 1;
            const y = _ConvertToLocalOdds(oEvent['terrorist_odds']);
            const point = [x, y];
            const plotPoint = _TransformPointIntoCanvasSpace(point);
            points.push(point);
            plotPoints.push(plotPoint);
            let delta = 0;
            if (index == 0)
                delta = oEvent['terrorist_odds'] - nStartingOdds;
            else
                delta = oEvent['terrorist_odds'] - arrEvents[index - 1]['terrorist_odds'];
            const sfx = delta < 0 ? "UIPanorama.round_report_line_down" : "UIPanorama.round_report_line_up";
            const delay = index * _m_timeslice;
            Scheduler.Schedule(delay, () => {
                _AddDamageToDamagePanel(oEvent, plotPoint);
                _DecoratePoint(oEvent, plotPoint);
                if (loopingSfxHandle)
                    UiToolkitAPI.StopSoundEvent(loopingSfxHandle, 0.1);
                loopingSfxHandle = UiToolkitAPI.PlaySoundEvent(sfx);
            });
        }
        Scheduler.Schedule(_m_arrTimelineEvents.length * _m_timeslice, () => {
            if (loopingSfxHandle)
                UiToolkitAPI.StopSoundEvent(loopingSfxHandle, 0.1);
        });
    }
    function _ProcessDamageEvents(arrEvents, startX) {
        for (let index = 0; index < arrEvents.length; ++index) {
            const oEvent = arrEvents[index];
            const x = startX + index + 1;
            const y = 50;
            const plotPoint = _TransformPointIntoCanvasSpace([x, y]);
            const delay = (_m_arrTimelineEvents.length + index) * _m_timeslice;
            Scheduler.Schedule(delay, () => {
                _AddDamageToDamagePanel(oEvent, plotPoint);
                _DecoratePoint(oEvent, plotPoint);
            });
        }
    }
    function _Colorize() {
        const bCT = _m_winningTeam == 3;
        for (let el of $.GetContextPanel().FindChildrenWithClassTraverse('team-colorize')) {
            el.SetHasClass('color-ct', bCT);
            el.SetHasClass('color-t', !bCT);
        }
    }
    function _FindDamageDataForPlayer(oEvent, xuid) {
        const oDamageData = oEvent.all_damage_data;
        const returnObj = {};
        for (let i = 0; i < oDamageData.length; i++) {
            if (oDamageData[i].other_xuid.toString() == xuid)
                Object.assign(returnObj, oDamageData[i]);
        }
        return returnObj;
    }
    function _UpdateDamage(xuid, healthRemoved, numHits, returnHealthRemoved, returnHits) {
        const elDamage = $.GetContextPanel().FindChildTraverse('Damage-' + xuid);
        if (!elDamage)
            return;
        elDamage.healthRemoved += healthRemoved;
        elDamage.healthRemoved = Math.min(elDamage.healthRemoved, 100);
        elDamage.numHits += numHits;
        elDamage.returnHealthRemoved += returnHealthRemoved;
        elDamage.returnHealthRemoved = Math.min(elDamage.returnHealthRemoved, 100);
        elDamage.returnHits += returnHits;
        if ((elDamage.returnHealthRemoved > 0) || (elDamage.healthRemoved > 0)) {
            const elDGiven = elDamage.FindChildTraverse('DamageGiven');
            const elDTaken = elDamage.FindChildTraverse('DamageTaken');
            elDGiven.SetDialogVariable('health_removed', elDamage.healthRemoved.toString());
            elDGiven.SetDialogVariable('num_hits', elDamage.numHits.toString());
            elDTaken.SetDialogVariable('health_removed', elDamage.returnHealthRemoved.toString());
            elDTaken.SetDialogVariable('num_hits', elDamage.returnHits.toString());
            elDGiven.visible = elDamage.healthRemoved > 0;
            elDTaken.visible = elDamage.returnHealthRemoved > 0;
            if (BEAM_ONLY_ON_DAMAGE) {
                const elTeamColorBar = $.GetContextPanel().FindChildTraverse('bar-' + xuid);
                if (elTeamColorBar) {
                    elTeamColorBar.RemoveClass('prereveal');
                }
            }
            const dmgDelay = 0.1;
            Scheduler.Schedule(dmgDelay, () => {
                if (elDamage && elDamage.IsValid())
                    elDamage.RemoveClass('prereveal');
            });
        }
    }
    function _AddDamageToDamagePanel(oEvent, plotPoint) {
        const elDamageContainer = $.GetContextPanel().FindChildTraverse('DamageContainer');
        const oDamage = _FindDamageDataForPlayer(oEvent, _m_localXuid);
        const victimData = oEvent['victim_data'];
        const objectiveData = oEvent['objective_data'];
        if (objectiveData)
            return;
        const elDamage = $.CreatePanel('Panel', elDamageContainer, 'Damage-' + victimData['xuid']);
        elDamage.BLoadLayoutSnippet('snippet-damage');
        elDamage.healthRemoved = 0;
        elDamage.numHits = 0;
        elDamage.returnHealthRemoved = 0;
        elDamage.returnHits = 0;
        elDamage.style.x = plotPoint[0] + "px";
        if (BEAM_ONLY_ON_DAMAGE) {
            const bCT = _m_winningTeam == 3;
            const elTeamColorBar = $.CreatePanel('Panel', _m_elPlotContainer, 'bar-' + victimData['xuid']);
            elTeamColorBar.AddClass('ris-graph__bar');
            elTeamColorBar.AddClass('prereveal');
            elTeamColorBar.SetHasClass('color-ct', bCT);
            elTeamColorBar.SetHasClass('color-t', !bCT);
            elTeamColorBar.style.x = plotPoint[0] + "px";
            elTeamColorBar.style.height = _FlipY(plotPoint)[1] + 70 + "px";
        }
        if (oDamage) {
            const healthRemoved = oDamage.health_removed || 0;
            const nHits = oDamage.num_hits || 0;
            const returnedHealthRemoved = oDamage.return_health_removed || 0;
            const nReturnHits = oDamage.return_num_hits || 0;
            _UpdateDamage(victimData['xuid'], healthRemoved, nHits, returnedHealthRemoved, nReturnHits);
        }
    }
    function _PlotStartingOdds(nStartingOdds, startPlotPoint) {
        const elStartPlot = $.CreatePanel("Panel", _m_elPlotContainer, 'Start');
        elStartPlot.BLoadLayoutSnippet('snippet-starting-odds');
        elStartPlot.style.y = startPlotPoint[1] + "px";
        $.GetContextPanel().SetDialogVariable('starting_chance', _ConvertToLocalOdds(nStartingOdds) + '%');
        _m_prevChance = nStartingOdds;
    }
    function _DecoratePoint(oEvent, plotPoint) {
        const victimData = oEvent['victim_data'];
        const objectiveData = oEvent['objective_data'];
        const key = objectiveData ? objectiveData['type'] : victimData ? victimData['xuid'] : '';
        const elEventPlot = $.CreatePanel("Panel", _m_elPlotContainer, 'Event-' + key);
        elEventPlot.BLoadLayoutSnippet('snippet-event');
        const elEventIcon = elEventPlot.FindChildTraverse('EventIcon');
        const elEventBG = elEventPlot.FindChildTraverse('EventBG');
        const elEventChance = elEventPlot.FindChildTraverse('EventChance');
        const elEventMain = elEventPlot.FindChildTraverse('EventMain');
        const elDeath = elEventPlot.FindChildTraverse('Death');
        const chance = _ConvertToLocalOdds(oEvent['terrorist_odds']);
        if (victimData) {
            const xuid = victimData['xuid'];
            const isBot = victimData['is_bot'];
            const teamNumber = victimData['team_number'];
            const color = victimData['color'];
            const isDead = victimData['is_dead'];
            elEventChance.visible = isDead;
            elDeath.visible = isDead;
            elEventIcon.SetImage("file://{images}/icons/ui/kill.svg");
            elEventIcon.visible = false;
            const elAvatarImage = elEventPlot.FindChildTraverse('Avatar');
            elAvatarImage.PopulateFromPlayerSlot(GameStateAPI.GetPlayerSlot(xuid.toString()));
            const bCT = teamNumber == 3;
            elAvatarImage.SwitchClass('teamstyle', 'team--' + (bCT ? 'CT' : 'TERRORIST'));
            if (!BEAM_ONLY_ON_DAMAGE) {
                const elTeamColorBar = $.CreatePanel('Panel', _m_elPlotContainer, 'bar-' + victimData['xuid']);
                elTeamColorBar.AddClass('ris-graph__bar');
                elTeamColorBar.SetHasClass('color-ct', bCT);
                elTeamColorBar.SetHasClass('color-t', !bCT);
                elTeamColorBar.style.x = plotPoint[0] + "px";
                elTeamColorBar.style.height = _FlipY(plotPoint)[1] + 70 + "px";
            }
            const rgbColor = TeamColor.GetTeamColor(Number(color));
            elEventMain.FindChildTraverse('JsAvatarTeamColor').style.washColor = 'rgb(' + rgbColor + ')';
        }
        else if (objectiveData) {
            const elAvatarImage = elEventPlot.FindChildTraverse('Avatar');
            elAvatarImage.visible = false;
            let src = "";
            let bEventCT = false;
            switch (objectiveData['type']) {
                case 0:
                    src = "file://{images}/icons/ui/bomb_c4.svg";
                    bEventCT = false;
                    break;
                case 1:
                    src = "file://{images}/icons/ui/bomb.svg";
                    bEventCT = false;
                    break;
                case 2:
                    src = "file://{images}/icons/equipment/defuser.svg";
                    bEventCT = true;
                    break;
                case 3:
                    src = "file://{images}/icons/ui/time_exp.svg";
                    bEventCT = true;
                    break;
            }
            elEventIcon.SetImage(src);
            elEventIcon.AddClass('event__icon--objective');
            elEventBG.SetHasClass('color-ct', bEventCT);
            elEventBG.SetHasClass('color-t', !bEventCT);
        }
        const delta = chance - _m_prevChance;
        const deltaSymbol = delta < 0 ? "▼" : delta > 0 ? "▲" : "";
        if (chance == 100) {
            elEventPlot.SetDialogVariable('chance', $.Localize('#ris_win'));
            elEventChance.FindChildTraverse('EventChanceNumber').style.color = '#ffffff';
        }
        else if (chance == 0) {
            elEventPlot.SetDialogVariable('chance', $.Localize('#ris_loss'));
            elEventChance.FindChildTraverse('EventChanceNumber').style.color = '#ffffff';
        }
        else {
            elEventPlot.SetDialogVariable('chance', deltaSymbol + chance + '%');
            elEventChance.FindChildTraverse('EventChanceNumber').style.color = _RemapToTeamColorRGB(chance - _m_prevChance, -20, 20);
        }
        elEventPlot.style.x = plotPoint[0] + "px";
        elEventPlot.style.y = plotPoint[1] + "px";
        if (elEventMain && elEventMain.IsValid())
            elEventMain.RemoveClass('prereveal');
        if (elEventChance && elEventChance.IsValid())
            elEventChance.RemoveClass('prereveal');
        if (elDeath && elDeath.IsValid())
            elDeath.RemoveClass('prereveal');
        const sfx = delta > 0 ? "UIPanorama.round_report_odds_up" : delta < 0 ? "UIPanorama.round_report_odds_dn" : "UIPanorama.round_report_odds_none";
        UiToolkitAPI.PlaySoundEvent(sfx);
        _m_prevChance = chance;
    }
    function _RemapToTeamColorRGB(val, min, max) {
        let frac = Math.min(1, Math.max(0, (val - min) / (max - min)));
        const bCTWon = _m_winningTeam == 3;
        if (bCTWon)
            frac = 1 - frac;
        const R = frac * (234 - 122) + 122;
        const G = 210;
        const B = (1 - frac) * (238 - 139) + 139;
        return 'rgb(' + R + "," + G + "," + B + ")";
    }
    function _Reset() {
        const localTeamNumber = GameStateAPI.GetAssociatedTeamNumber(_m_localXuid);
        const bUseInEye = GameStateAPI.IsDemoOrHltv() || (localTeamNumber != 2 && localTeamNumber != 3);
        _m_localXuid = bUseInEye ? GameStateAPI.GetHudPlayerXuid() : GameStateAPI.GetLocalPlayerXuid();
        _m_teamPerspective = (localTeamNumber == 2 || localTeamNumber == 3) ? localTeamNumber : 2;
        const bCT = _m_teamPerspective == 3;
        _m_elCanvas = $.GetContextPanel().FindChildTraverse('RisCanvas');
        _m_elPlotContainer = $.GetContextPanel().FindChildTraverse('RisPlotContainer');
        Scheduler.Cancel();
        _m_arrTimelineEvents = [];
        _m_arrPersonalDamageEvents = [];
        _m_elPlotContainer.RemoveAndDeleteChildren();
        const elDamageContainer = $.GetContextPanel().FindChildTraverse('DamageContainer');
        elDamageContainer.RemoveAndDeleteChildren();
        _m_elCanvas.ClearJS('rgba(0,0,0,0)');
        $.GetContextPanel().SetDialogVariable('team', GameStateAPI.GetTeamClanName(bCT ? 'CT' : 'TERRORIST'));
        const elTeamLogo = $.GetContextPanel().FindChildTraverse('RisTeamLogo');
        if (elTeamLogo) {
            elTeamLogo.SetImage(bCT ? "file://{images}/icons/ui/ct_logo_1c.svg" : "file://{images}/icons/ui/t_logo_1c.svg");
        }
        _Colorize();
    }
    {
        $.RegisterEventHandler('HudWinPanel_MVP', $.GetContextPanel(), _SetMVP);
        _Init();
    }
})(HudWinPanel || (HudWinPanel = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHVkd2lucGFuZWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9jb250ZW50L2NzZ28vcGFub3JhbWEvc2NyaXB0cy9odWQvaHVkd2lucGFuZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLHFDQUFxQztBQUNyQyxxQ0FBcUM7QUFDckMseUNBQXlDO0FBQ3pDLGdEQUFnRDtBQUNoRCxnREFBZ0Q7QUFDaEQsK0NBQStDO0FBQy9DLCtDQUErQztBQUMvQyw2REFBNkQ7QUFFN0QsSUFBVSxXQUFXLENBK3VCcEI7QUEvdUJELFdBQVUsV0FBVztJQStCcEIsSUFBSSxXQUF1QixDQUFDO0lBQzVCLElBQUksa0JBQTJCLENBQUM7SUFFaEMsSUFBSSx1QkFBK0IsQ0FBQztJQUNwQyxJQUFJLHNCQUE4QixDQUFDO0lBQ25DLElBQUksa0JBQTBCLENBQUM7SUFDL0IsSUFBSSxZQUFvQixDQUFDO0lBQ3pCLElBQUksWUFBb0IsQ0FBQztJQUV6QixJQUFJLFFBQVEsR0FBRyxLQUFLLENBQUM7SUFDckIsSUFBSSxTQUFpQixDQUFDO0lBQ3RCLElBQUksYUFBcUIsQ0FBQztJQUMxQixJQUFJLHlCQUF5QixHQUFHLEtBQUssQ0FBQztJQUN0QyxJQUFJLGlCQUFpQixHQUFHLEtBQUssQ0FBQztJQUc5QixJQUFJLG9CQUFvQixHQUE0QyxFQUFFLENBQUM7SUFDdkUsSUFBSSwwQkFBMEIsR0FBNEMsRUFBRSxDQUFDO0lBRTdFLElBQUksY0FBMEIsQ0FBQztJQUUvQixNQUFNLGlCQUFpQixHQUFHLENBQUMsQ0FBQztJQUU1QixNQUFNLG1CQUFtQixHQUFHLEtBQUssQ0FBQztJQUVsQyxTQUFTLEtBQUs7UUFFYixJQUFLLFFBQVE7WUFDWixPQUFPO1FBRVIsQ0FBQyxDQUFDLHlCQUF5QixDQUFFLGdDQUFnQyxFQUFFLG1CQUFtQixDQUFFLENBQUM7UUFDckYsQ0FBQyxDQUFDLHlCQUF5QixDQUFFLGFBQWEsRUFBRSxvQkFBb0IsQ0FB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