"use strict";
/// <reference path="csgo.d.ts" />
/// <reference path="common/formattext.ts" />
/// <reference path="mock_adapter.ts" />
/// <reference path="xpshop_track.ts" />
/// <reference path="rank_skillgroup_particles.ts" />
/// <reference path="endofmatch.ts" />
var EOM_Rank;
(function (EOM_Rank) {
    let _m_pauseBeforeEnd = 1.0;
    const _m_cP = $.GetContextPanel();
    _m_cP.Data().m_retries = 0;
    function _DisplayMe() {
        if (!_m_cP || !_m_cP.IsValid())
            return;
        if (!MockAdapter.bXpDataReady(_m_cP))
            return false;
        if (MyPersonaAPI.GetElevatedState() !== 'elevated')
            return false;
        let xPPerLevel = MyPersonaAPI.GetXpPerLevel();
        let oXpData = MockAdapter.XPDataJSO(_m_cP);
        if (!oXpData)
            return false;
        const xpBonuses = MyPersonaAPI.GetActiveXpBonuses();
        const bEligibleForCarePackage = xpBonuses.split(',').includes('2');
        const earnedFreeRewards = oXpData.hasOwnProperty('free_rewards') ? Number(oXpData.free_rewards) : 0;
        const xp_trail_level = oXpData.hasOwnProperty('xp_trail_level') ? Number(oXpData.xp_trail_level) : 0;
        $.GetContextPanel().SetHasClass('care-package-eligible', bEligibleForCarePackage || (earnedFreeRewards != 0));
        let elCarePackage = _m_cP.FindChildTraverse('jsEomCarePackage');
        elCarePackage.RemoveClass('earned-rewards');
        let elProgress = _m_cP.FindChildInLayoutFile("id-eom-rank__bar-container");
        let elNew = _m_cP.FindChildInLayoutFile("id-eom-new-reveal");
        let elCurrent = _m_cP.FindChildInLayoutFile("id-eom-rank__current");
        let elBar = _m_cP.FindChildInLayoutFile("id-eom-rank__bar");
        let elRankLister = _m_cP.FindChildInLayoutFile("id-eom-rank__lister");
        let elRankListerItems = _m_cP.FindChildInLayoutFile("id-eom-rank__lister__items");
        let arrPreRankXP = [];
        let arrPostRankXP = [];
        let totalXP = 0;
        let maxLevel = InventoryAPI.GetMaxLevel();
        let elPanel = _m_cP.FindChildTraverse('id-eom-rank__current');
        elPanel.TriggerClass('show');
        _m_cP.AddClass('eom-rank-show');
        let currentRank = oXpData.current_level;
        currentRank = currentRank < maxLevel ? currentRank : maxLevel;
        elCurrent.SetDialogVariableInt("level", currentRank);
        elCurrent.SetDialogVariable('name', $.Localize('#XP_RankName_' + currentRank, elCurrent));
        _m_cP.FindChildInLayoutFile("id-eom-rank__current__emblem").SetImage("file://{images}/icons/xp/level" + currentRank + ".png");
        const newRank = currentRank < maxLevel ? (currentRank + 1) : maxLevel;
        let elCurrentListerItem;
        let _xpSoundNum = 1;
        let currentXpPointer = 0;
        function _AddXPBar(reason, xp, xpToXpTrailEvent = -1) {
            const sPerXp = 0.0005;
            const duration = sPerXp * xp;
            const sPerSoundTick = 0.082;
            for (let t = sPerSoundTick; t < duration; t += sPerSoundTick) {
                $.Schedule(animTime + t, () => $.DispatchEvent('CSGOPlaySoundEffect', 'UIPanorama.XP.Ticker', 'eom-rank'));
            }
            $.Schedule(animTime, () => {
                if (!elBar.IsValid())
                    return 0;
                let elRankSegment = $.CreatePanel('Panel', elBar, 'id-eom-rank__bar__segment');
                elRankSegment.AddClass("eom-rank__bar__segment");
                elBar.MoveChildAfter(elRankLister, elRankSegment);
                let colorClass;
                if (reason == "old") {
                    colorClass = "eom-rank__blue";
                }
                else if (reason == "levelup") {
                    colorClass = "eom-rank__purple";
                }
                else if (reason == "6" || reason == "7") {
                    colorClass = "eom-rank__yellow";
                }
                else if (reason == "9" || reason == "10" || reason == "59") {
                    colorClass = "eom-rank__yellow";
                }
                else {
                    colorClass = "eom-rank__green";
                }
                $.DispatchEvent('CSGOPlaySoundEffect', 'UIPanorama.XP.Milestone_0' + _xpSoundNum.toString(), 'eom-rank');
                if (_xpSoundNum < 4) {
                    _xpSoundNum++;
                }
                elRankSegment.AddClass(colorClass);
                elRankSegment.style.width = '0%';
                $.Schedule(0.0, () => {
                    if (elRankSegment && elRankSegment.IsValid()) {
                        elRankSegment.style.width = (xp / xPPerLevel * 100) + '%;';
                    }
                });
                elRankSegment.style.transitionDuration = duration + "s";
                if (elCurrentListerItem) {
                    elCurrentListerItem.AddClass("eom-rank__lister__item--old");
                }
                if (elRankListerItems && elRankListerItems.IsValid()) {
                    elCurrentListerItem = $.CreatePanel('Panel', elRankListerItems, 'id-eom-rank__lister__items__' + reason);
                    elCurrentListerItem.BLoadLayoutSnippet("snippet_rank__lister__item");
                    elCurrentListerItem.RemoveClass("eom-rank__lister__item--appear");
                    let elAmtLabel = elCurrentListerItem.FindChildTraverse('id-eom-rank__lister__item__amt');
                    elAmtLabel.SetDialogVariable("xp", String(xp));
                    elAmtLabel.text = $.Localize("#EOM_XP_Bar", elAmtLabel);
                    elAmtLabel.AddClass(colorClass);
                    let elDescLabel = elCurrentListerItem.FindChildTraverse('id-eom-rank__lister__item__desc');
                    elDescLabel.SetDialogVariable("gamemode", $.Localize("#SFUI_GameMode_" + MatchStatsAPI.GetGameMode()));
                    elDescLabel.text = $.Localize("#XP_Bonus_RankUp_" + reason, elDescLabel);
                }
            });
            currentXpPointer += xp;
            if (xpToXpTrailEvent > -1) {
                const xpTrailAnimStartTime = xpToXpTrailEvent * sPerXp;
                $.Schedule(animTime + xpTrailAnimStartTime, () => {
                    if (_m_cP && _m_cP.IsValid()) {
                        _m_cP.SetHasClass('xptrail-acquired', true);
                        _DisplayXpTrailRemainingTime(oXpData.xp_trail_remaining);
                        HonorIcon.SetOptions({
                            honor_icon_frame_panel: _m_cP.FindChildTraverse('jsHonorIcon'),
                            do_fx: true,
                            xptrail_value: xp_trail_level,
                            force_icon: 'xptrail',
                        });
                    }
                });
            }
            return duration;
        }
        ;
        totalXP += oXpData.current_xp;
        for (let elem of oXpData.xp_progress_data) {
            let xp = elem.xp_points;
            let key = elem.xp_category;
            if (totalXP + xp < xPPerLevel) {
                arrPreRankXP.push({ reason: key, xp: xp });
            }
            else {
                let xp_upto = xPPerLevel - totalXP;
                let xp_remainder = totalXP + xp - xPPerLevel;
                if (xp_upto > 0) {
                    arrPreRankXP.push({ reason: key, xp: xp_upto });
                    arrPostRankXP.push({ reason: key, xp: xp_remainder });
                }
                else
                    arrPostRankXP.push({ reason: key, xp: xp });
            }
            totalXP += xp;
        }
        const xpTrailXpPosition = totalXP + (oXpData.hasOwnProperty('xp_trail_xp_needed') ? Number(oXpData.xp_trail_xp_needed) : 0);
        function _AnimSequenceNext(func, duration = 0) {
            $.Schedule(animTime, func);
            animTime += duration;
        }
        let _AnimPause = function (sec) {
            animTime += sec;
        };
        let animTime = 0;
        _AnimPause(1.0);
        function _PlaceXpTrail(xp) {
            HonorIcon.SetOptions({
                honor_icon_frame_panel: _m_cP.FindChildTraverse('jsHonorIcon'),
                do_fx: false,
                xptrail_value: xp_trail_level,
                force_icon: 'xptrail',
            });
            _m_cP.SetHasClass('xptrail-enabled', xp >= 0);
            if (xp < 0)
                return;
            const elXpTrailIcon = _m_cP.FindChildTraverse('jsHonorIcon');
            const XpTrail_pct = (xp / xPPerLevel * 100) - 2;
            elXpTrailIcon.style.x = (XpTrail_pct) + '%;';
        }
        function _DisplayXpTrailRemainingTime(xp_trail_remaining) {
            _m_cP.SetHasClass('xptrail-remaining-time-enabled', (xp_trail_remaining != undefined) && (xp_trail_remaining > 0));
            _m_cP.SetDialogVariable('xp-trail-remaining', FormatText.SecondsToSignificantTimeString(xp_trail_remaining).toLowerCase());
        }
        if (oXpData.current_xp > 0) {
            const xpToXpTrailEvent = ((xpTrailXpPosition > 0) && (xpTrailXpPosition <= oXpData.current_xp)) ? xpTrailXpPosition : -1;
            _AnimPause(_AddXPBar("old", oXpData.current_xp, xpToXpTrailEvent));
        }
        const xpToXpTrailEvent = xpTrailXpPosition <= 5000 ? xpTrailXpPosition : -1;
        _PlaceXpTrail(xpToXpTrailEvent);
        const DelayXpTrailAnnounce = xpTrailXpPosition > 0 && xpTrailXpPosition <= totalXP;
        if (!DelayXpTrailAnnounce)
            _DisplayXpTrailRemainingTime(oXpData.xp_trail_remaining);
        for (let i = 0; i < arrPreRankXP.length; i++) {
            _AnimPause(1.0);
            if (arrPreRankXP[i].xp > 0) {
                const xpToXpTrailEvent = ((xpTrailXpPosition > currentXpPointer) && (xpTrailXpPosition <= currentXpPointer + arrPreRankXP[i].xp)) ? xpTrailXpPosition - currentXpPointer : -1;
                _AnimPause(_AddXPBar(arrPreRankXP[i].reason, arrPreRankXP[i].xp, xpToXpTrailEvent));
            }
        }
        if (totalXP >= xPPerLevel) {
            let elRankEarnedCarePackagefx = _m_cP.FindChildInLayoutFile("id-eom-rank_carepackage_earned_effects");
            let elRankCarePackageBgfx = _m_cP.FindChildInLayoutFile("id-eom-rank_carepackage_bg_effects");
            _AnimSequenceNext(() => {
                if (!elProgress || !elProgress.IsValid())
                    return;
                $.DispatchEvent('CSGOPlaySoundEffect', 'UIPanorama.XP.BarFull', 'eom-rank');
                elProgress.FindChildInLayoutFile('id-eom-rank-bar-white').AddClass('eom-rank__bar--white--show');
                if (earnedFreeRewards > 0) {
                    elRankCarePackageBgfx.SetParticleNameAndRefresh("particles/ui/rank_carepackage_bg_base.vpcf");
                    elRankCarePackageBgfx.SetControlPoint(3, 0, 0, 1);
                    elRankCarePackageBgfx.StartParticles();
                }
            }, 1);
            if (earnedFreeRewards > 0) {
                _AnimSequenceNext(() => {
                    if (!_m_cP || !_m_cP.IsValid())
                        return;
                    let elCarePackage = _m_cP.FindChildTraverse('jsEomCarePackage');
                    $.DispatchEvent('CSGOPlaySoundEffect', 'UIPanorama.tab_mainmenu_shop', 'eom-rank');
                    elCarePackage.AddClass('earned-rewards');
                    elRankEarnedCarePackagefx.SetParticleNameAndRefresh("particles/ui/rank_carepackage_recieve.vpcf");
                    elRankEarnedCarePackagefx.SetControlPoint(3, 0, 0, 1);
                }, 2);
            }
            _AnimSequenceNext(() => {
                if (!elProgress || !elProgress.IsValid() ||
                    !elCurrent || !elCurrent.IsValid() ||
                    !elBar || !elBar.IsValid() ||
                    !elNew || !elNew.IsValid() ||
                    !elCurrent || !elCurrent.IsValid())
                    return;
                $.DispatchEvent('CSGOPlaySoundEffect', 'UIPanorama.XP.NewRank', 'eom-rank');
                elBar.FindChildrenWithClassTraverse("eom-rank__bar__segment").forEach(entry => entry.DeleteAsync(.0));
                elRankCarePackageBgfx.StopParticlesWithEndcaps();
                elCurrent.SetDialogVariableInt("level", newRank);
                elCurrent.SetDialogVariable('name', $.Localize('#XP_RankName_' + newRank, elCurrent));
                _m_cP.SetDialogVariable('rank_new', $.Localize('#XP_RankName_Display', elCurrent));
                _m_cP.FindChildInLayoutFile("id-eom-rank__current__label").text = $.Localize("{s:rank_new}", elCurrent);
                _m_cP.FindChildInLayoutFile("id-eom-rank__current__emblem").SetImage("file://{images}/icons/xp/level" + newRank + ".png");
                elNew.RemoveClass("hidden");
                elNew.FindChildInLayoutFile('id-eom-new-reveal-image').SetImage("file://{images}/icons/xp/level" + newRank + ".png");
                elNew.TriggerClass("eom-rank-new-reveal--anim");
                let elParticleEffect = elNew.FindChildInLayoutFile('id-eom-new-reveal-flare');
                let aParticleSettings = RankSkillgroupParticles.GetRankParticleSettings(newRank);
                elParticleEffect.SetParticleNameAndRefresh(aParticleSettings.particleName);
                elParticleEffect.SetControlPoint(aParticleSettings.cpNumber, aParticleSettings.cpValue[0], aParticleSettings.cpValue[1], aParticleSettings.cpValue[2]);
                elParticleEffect.StartParticles();
            }, 3);
            _AnimSequenceNext(() => {
                if (!_m_cP || !_m_cP.IsValid())
                    return;
                const xpToXpTrailEvent = xpTrailXpPosition > 5000 && xpTrailXpPosition <= 10000 ? xpTrailXpPosition - 5000 : -1;
                _PlaceXpTrail(xpToXpTrailEvent);
            });
            _AnimSequenceNext(() => {
                if (!elProgress || !elProgress.IsValid() ||
                    !elCurrent || !elCurrent.IsValid() ||
                    !elBar || !elBar.IsValid() ||
                    !elNew || !elNew.IsValid() ||
                    !elCurrent || !elCurrent.IsValid())
                    return;
                elProgress.FindChildInLayoutFile('id-eom-rank-bar-white').RemoveClass('eom-rank__bar--white--show');
            });
            for (let i = 0; i < arrPostRankXP.length; i++) {
                const xpToXpTrailEvent = ((xpTrailXpPosition > currentXpPointer) && (xpTrailXpPosition <= currentXpPointer + arrPostRankXP[i].xp)) ? xpTrailXpPosition - currentXpPointer : -1;
                _AnimPause(_AddXPBar(arrPostRankXP[i].reason, arrPostRankXP[i].xp, xpToXpTrailEvent));
            }
            _AnimPause(2.0);
        }
        _AnimSequenceNext(() => {
        }, 1);
        let oXpShopData = MockAdapter.XPShopDataJSO(_m_cP);
        if (oXpShopData && oXpShopData.hasOwnProperty('prematch')) {
            const elRoot = _m_cP.FindChildTraverse('jsXpShopTrackRoot');
            const elXpShopContainer = _m_cP.FindChildTraverse('jsXpShopTrackContainer');
            oXpShopData.prematch.xp_tracks.forEach(function (track, idx) {
                const elTrack = $.CreatePanel('Panel', elXpShopContainer, 'id-xpshop_track_' + idx);
                elTrack.BLoadLayout('file://{resources}/layout/xpshop_track.xml', false, false);
                XpShopTrack.XpShopInit({
                    xpshop_track_frame_panel: elTrack,
                    xpshop_track_value: track,
                });
            });
            _AnimSequenceNext(() => {
                if (elRoot && elRoot.IsValid())
                    elRoot.AddClass('reveal');
            }, 0.3);
            if (oXpShopData.hasOwnProperty('postmatch')) {
                _AnimPause(1.0);
                _AnimSequenceNext(() => {
                    oXpShopData.postmatch.xp_tracks.forEach(function (track, idx) {
                        const elTrack = (elXpShopContainer && elXpShopContainer.IsValid()) ? elXpShopContainer.FindChildTraverse('id-xpshop_track_' + idx) : undefined;
                        if (elTrack) {
                            XpShopTrack.XpShopUpdate({
                                xpshop_track_frame_panel: elTrack,
                                xpshop_track_value: track,
                            });
                        }
                    });
                }, 2);
            }
        }
        _m_pauseBeforeEnd += animTime;
        return true;
    }
    ;
    function Start() {
        if (MockAdapter.GetMockData() && !MockAdapter.GetMockData().includes('RANK')) {
            _End();
            return;
        }
        if (_DisplayMe()) {
            EndOfMatch.SwitchToPanel('eom-rank');
            EndOfMatch.StartDisplayTimer(_m_pauseBeforeEnd);
            $.Schedule(_m_pauseBeforeEnd, _End);
        }
        else {
            _End();
            return;
        }
    }
    function _End() {
        EndOfMatch.ShowNextPanel();
    }
    function Shutdown() {
    }
    {
        EndOfMatch.RegisterPanelObject({
            name: 'eom-rank',
            Start: Start,
            Shutdown: Shutdown
        });
    }
})(EOM_Rank || (EOM_Rank = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW5kb2ZtYXRjaC1yYW5rLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vY29udGVudC9jc2dvL3Bhbm9yYW1hL3NjcmlwdHMvZW5kb2ZtYXRjaC1yYW5rLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxrQ0FBa0M7QUFDbEMsNkNBQTZDO0FBQzdDLHdDQUF3QztBQUN4Qyx3Q0FBd0M7QUFDeEMscURBQXFEO0FBQ3JELHNDQUFzQztBQVN0QyxJQUFVLFFBQVEsQ0FnaEJqQjtBQWhoQkQsV0FBVSxRQUFRO0lBRWpCLElBQUksaUJBQWlCLEdBQUcsR0FBRyxDQUFDO0lBQzVCLE1BQU0sS0FBSyxHQUFHLENBQUMsQ0FBQyxlQUFlLEVBQTZCLENBQUM7SUFFN0QsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUM7SUFFM0IsU0FBUyxVQUFVO1FBRWxCLElBQUssQ0FBQyxLQUFLLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFO1lBQzlCLE9BQU87UUFFUixJQUFLLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBRSxLQUFLLENBQUU7WUFDdEMsT0FBTyxLQUFLLENBQUM7UUFFZCxJQUFLLFlBQVksQ0FBQyxnQkFBZ0IsRUFBRSxLQUFLLFVBQVU7WUFDbEQsT0FBTyxLQUFLLENBQUM7UUFFZCxJQUFJLFVBQVUsR0FBRyxZQUFZLENBQUMsYUFBYSxFQUFFLENBQUM7UUFFOUMsSUFBSSxPQUFPLEdBQUcsV0FBVyxDQUFDLFNBQVMsQ0FBRSxLQUFLLENBQUUsQ0FBQztRQUU3QyxJQUFLLENBQUMsT0FBTztZQUNaLE9BQU8sS0FBSyxDQUFDO1FBTWQsTUFBTSxTQUFTLEdBQUcsWUFBWSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFDcEQsTUFBTSx1QkFBdUIsR0FBRyxTQUFTLENBQUMsS0FBSyxDQUFFLEdBQUcsQ0FBRSxDQUFDLFFBQVEsQ0FBRSxHQUFHLENBQUUsQ0FBQztRQUN2RSxNQUFNLGlCQUFp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