"use strict";
/// <reference path="../csgo.d.ts" />
/// <reference path="../common/hold_button.ts" />
/// <reference path="../common/iteminfo.ts" />
/// <reference path="../inspect.ts" />
/// <reference path="popup_inspect_shared.ts" />
/// <reference path="popup_can_apply_pick_slot.ts" />
/// <reference path="../generated/items_event_current_generated_store.ts" />
/// <reference path="../common/shopping_cart.ts" />
var InspectAsyncActionBar;
(function (InspectAsyncActionBar) {
    let m_scheduleHandle = null;
    function Init() {
        const worktype = InspectShared.GetPopupSetting('work_type');
        const toolId = InspectShared.GetPopupSetting('tool_id');
        const showXrayMachineUi = InspectShared.GetPopupSetting('is_xray_machine');
        const allowRental = InspectShared.GetPopupSetting('allow_rent');
        const elAsyncActionBarPanel = $.GetContextPanel().FindChildInLayoutFile('PopUpInspectAsyncBar');
        $.GetContextPanel().AddClass('PopupPanelCapability_' + worktype);
        if (InspectShared.GetPopupSetting('force_hide_async_bar') ||
            !worktype ||
            (allowRental && !showXrayMachineUi) ||
            (worktype === 'nameable' && !toolId) ||
            _DoesNotMeetDecodalbeRequirements()) {
            elAsyncActionBarPanel.AddClass('hidden');
            return;
        }
        elAsyncActionBarPanel.RemoveClass('hidden');
        _SetUpDescription(elAsyncActionBarPanel);
        _SetUpButtonStates(elAsyncActionBarPanel);
        elAsyncActionBarPanel.FindChildInLayoutFile('InspectWeaponBtn').checked = true;
        _ShowHideInspectViewButtons(elAsyncActionBarPanel);
        _ChangeSceneryBtn(elAsyncActionBarPanel);
        _ShowZoomBtn(elAsyncActionBarPanel);
        elAsyncActionBarPanel.FindChildInLayoutFile('AsyncItemWorkCancelBtn').SetPanelEvent('onactivate', () => {
            if (_DefaultZoomView(worktype, elAsyncActionBarPanel) === false)
                _ClosePopup();
        });
        if (worktype === 'prestigecheck') {
            _OnAccept($.GetContextPanel().Data().oSettings, elAsyncActionBarPanel);
        }
        const cp = $.GetContextPanel();
        if (!elAsyncActionBarPanel.Data().PanelRegisteredForEvents) {
            elAsyncActionBarPanel.Data().PanelRegisteredForEvents = $.RegisterForUnhandledEvent('PanoramaComponent_Inventory_ItemCustomizationNotification', (...args) => {
                return _OnItemCustomization(...args, cp);
            });
            if (worktype !== 'decodeable' && worktype !== 'nameable' && worktype !== 'remove_sticker') {
                $.RegisterForUnhandledEvent('PanoramaComponent_MyPersona_InventoryUpdated', _OnMyPersonaInventoryUpdated);
                $.RegisterForUnhandledEvent('PanoramaComponent_Inventory_PrestigeCoinResponse', _OnInventoryPrestigeCoinResponse);
            }
            if (worktype === 'craft_souvenir') {
                $.RegisterForUnhandledEvent('PanoramaComponent_Store_VolatileShopSubscribe', (...args) => { _OnVolatileShopSubscribe(...args, cp); });
                _EnsureVolatileShopSubscribed(cp);
            }
        }
    }
    InspectAsyncActionBar.Init = Init;
    function _EnsureVolatileShopSubscribed(cp) {
        if (!cp || !cp.IsValid())
            return;
        if (cp.Data().refreshSubscriptionHandle) {
            $.CancelScheduled(cp.Data().refreshSubscriptionHandle);
            cp.Data().refreshSubscriptionHandle = null;
        }
        StoreAPI.VolatileShopSubscribe(g_ActiveTournamentInfo.itemid_dynamic_stickers);
        cp.Data().refreshSubscriptionHandle = $.Schedule(150, () => _EnsureVolatileShopSubscribed(cp));
    }
    function _DoesNotMeetDecodalbeRequirements() {
        if (InspectShared.GetPopupSetting('work_type') === 'decodeable') {
            const sRestriction = InventoryAPI.GetDecodeableRestriction(InspectShared.GetPopupSetting('item_id'));
            const showXrayMachineUi = InspectShared.GetPopupSetting('is_xray_machine');
            if (sRestriction === 'restricted' || (sRestriction === 'xray' && !showXrayMachineUi) || InspectShared.GetPopupSetting('inspect_only'))
                return false;
            return (!InspectShared.GetPopupSetting('tool_id') && !InspectShared.GetPopupSetting('is_keyless'));
        }
        return false;
    }
    function _PerformAsyncAction(oSettings, bForceRemoveSticker = false) {
        const worktype = oSettings.work_type;
        const itemId = oSettings.item_id;
        const toolId = oSettings.tool_id;
        const bAllowXray = oSettings.allow_xray_claim;
        const selectedSlot = parseInt($.GetContextPanel().GetAttributeString('selectedItemToApplySlot', ''));
        if (worktype === 'useitem' || worktype === 'usegift') {
            InventoryAPI.UseTool(itemId, '');
        }
        else if (worktype === 'delete') {
            InventoryAPI.DeleteItem(itemId);
        }
        else if (worktype === 'prestigecheck') {
            InventoryAPI.RequestPrestigeCoinCheck();
        }
        else if (worktype === 'prestigeget' || worktype === 'prestigeupgrade') {
            InventoryAPI.RequestPrestigeCoin(InventoryAPI.GetItemDefinitionIndex(itemId));
        }
        else if (worktype === 'nameable') {
            $.DispatchEvent("CSGOPlaySoundEffect", "rename_applyConfirm", "MOUSE");
            InventoryAPI.UseTool(toolId, itemId);
            if ($.GetContextPanel().FindChildInLayoutFile('NameableRemoveConfirm')) {
                $.GetContextPanel().FindChildInLayoutFile('NameableRemoveConfirm').enabled = false;
                $.GetContextPanel().FindChildInLayoutFile('NameableValidBtn').enabled = false;
            }
        }
        else if (worktype === 'remove_patch') {
            $.DispatchEvent('CSGOPlaySoundEffect', 'UI.StickerScratch', 'MOUSE');
            InventoryAPI.WearItemSticker(itemId, selectedSlot, 0);
        }
        else if (worktype === 'remove_keychain') {
            $.DispatchEvent('CSGOPlaySoundEffect', 'UI.StickerScratch', 'MOUSE');
            InventoryAPI.RemoveKeychain(itemId, 0);
        }
        else if (worktype === 'remove_sticker') {
            if (oSettings.remove_sticker_all_at_once) {
                $.DispatchEvent('CSGOPlaySoundEffect', 'UI.StickerScratch', 'MOUSE');
                _ClosePopup();
                const elPanel = UiToolkitAPI.ShowCustomLayoutPopup('popup-inspect-' + itemId, 'file://{resources}/layout/popups/popup_capability_can_keychain.xml');
                let oSouvenirSettings = {
                    item_id: itemId,
                    tool_id: '',
                    umid_souvenir: oSettings.umid_souvenir,
                    work_type: 'craft_souvenir'
                };
                elPanel.Data().oSettings = oSouvenirSettings;
                return;
            }
            CapabilityCanSticker.OnScratchSticker(itemId, selectedSlot, bForceRemoveSticker, oSettings.popup_panel);
        }
        else if (worktype === 'can_wrap_sticker' && !oSettings.tool_id) {
            $.DispatchEvent('CSGOPlaySoundEffect', 'sticker_applyConfirm', 'MOUSE');
            InventoryAPI.RemoveKeychain(itemId, 0);
        }
        else if (worktype === 'can_sticker' || worktype === 'can_patch' || worktype === 'can_keychain' || worktype === 'can_wrap_sticker') {
            $.DispatchEvent('CSGOPlaySoundEffect', 'sticker_applyConfirm', 'MOUSE');
            InventoryAPI.SetStickerToolSlot(itemId, selectedSlot);
            InventoryAPI.UseTool(toolId, itemId);
        }
        else if (worktype === 'craft_souvenir') {
            const fauxCartItemID = oSettings.temp_display_item_id;
            const nPurchaseCost = _ComputeTotalSouvenirCost(oSettings.popup_panel, fauxCartItemID).discountPrice;
            const strPurchaseCommand = 'craft_souvenir:' + itemId + ':' + oSettings.umid_souvenir;
            m_SouvenirCheckoutCart = ShoppingCart.findOrCreateTempCart(itemId, true);
            const shopItem = {
                id: fauxCartItemID,
                name: ItemInfo.GetFormattedName(fauxCartItemID),
                price: nPurchaseCost,
                checkout_id: strPurchaseCommand
            };
            m_SouvenirCheckoutCart.clearCart();
            m_SouvenirCheckoutCart.addItem(shopItem);
            $.DispatchEvent('CSGOPlaySoundEffect', 'sticker_applyConfirm', 'MOUSE');
            const popupPanel = UiToolkitAPI.ShowCustomLayoutPopupParameters('id-popup-shopping-cart-checkout', 'file://{resources}/layout/popups/popup_shopping_cart_checkout.xml', 'cartid=' + itemId +
                '&checkoutsuffix=_souvenir');
            popupPanel.Data().eventId = g_ActiveTournamentInfo.eventid;
        }
        else if (worktype === 'decodeable') {
            if (ItemInfo.IsSpraySealed(itemId) || ItemInfo.ItemDefinitionNameSubstrMatch(itemId, 'tournament_pass_')) {
                InventoryAPI.UseTool(itemId, '');
            }
            else if (InventoryAPI.GetDecodeableRestriction(itemId) === "xray" && !bAllowXray) {
                InventoryAPI.UseTool(itemId, itemId);
            }
            else if (InventoryAPI.GetItemAttributeValue(itemId, '{uint32}volatile container')) {
                $.DispatchEvent('CSGOPlaySoundEffect', 'UI.Laptop.Unlock', 'MOUSE');
                InventoryAPI.UseTool(toolId, itemId);
            }
            else {
                InventoryAPI.UseTool(toolId, itemId);
            }
            if (InventoryAPI.GetDecodeableRestriction(itemId) !== "xray") {
                $.DispatchEvent('StartDecodeableAnim');
            }
        }
    }
    function _SetUpButtonStates(elPanel) {
        const elOK = elPanel.FindChildInLayoutFile('AsyncItemWorkAcceptConfirm');
        const elNegative = elPanel.FindChildInLayoutFile('AsyncItemWorkAcceptNegative');
        const worktype = InspectShared.GetPopupSetting('work_type');
        const itemId = InspectShared.GetPopupSetting('item_id');
        let sOkButtonText = '#popup_' + worktype + '_button';
        if (InspectShared.GetPopupSetting('is_workshop_preview')) {
            elOK.AddClass('hidden');
            if (elNegative)
                elNegative.AddClass('hidden');
        }
        const oSettings = $.GetContextPanel().Data().oSettings;
        function _SetPanelEventOnAccept() {
            elOK.SetPanelEvent('onactivate', () => _OnAccept(oSettings, elPanel));
        }
        if (worktype === '') {
            return;
        }
        if (worktype === 'can_wrap_sticker') {
            elOK.visible = false;
            elNegative.visible = false;
            const toolId = InspectShared.GetPopupSetting('tool_id');
            ;
            const btnId = toolId ? 'AsyncItemWorkAcceptConfirmHold' : 'AsyncItemWorkAcceptNegativeHold';
            const btnHoldAction = elPanel.FindChildInLayoutFile(btnId);
            const locString = !toolId ? '#popup_' + worktype + '_button_negative' : '#popup_' + worktype + '_button';
            btnHoldAction.RemoveClass('AsyncItemWorkAcceptNegativeHidden');
            const btnSettings = {
                btn: btnHoldAction,
                tooltip: !toolId ? '#popup_' + worktype + '_button_negative_tooltip' : '#popup_' + worktype + '_button_tooltip',
                locString: locString,
                loopingSound: 'UI.Laptop.ButtonFillLoop',
                timerCompleteAction: () => {
                    _OnAccept(oSettings, elPanel);
                    btnHoldAction.enabled = false;
                }
            };
            HoldButton.SetupButton(btnSettings);
            return;
        }
        if (worktype === 'craft_souvenir') {
            elOK.visible = false;
            elNegative.visible = false;
            const btnId = 'AsyncItemWorkAcceptConfirmHold';
            const btnHoldAction = elPanel.FindChildInLayoutFile(btnId);
            let locString = '#popup_' + worktype + '_button';
            btnHoldAction.RemoveClass('AsyncItemWorkAcceptNegativeHidden');
            const btnSettings = {
                btn: btnHoldAction,
                locString: locString,
                loopingSound: 'UI.Laptop.ButtonFillLoop',
                timerCompleteAction: () => {
                    _OnAccept(oSettings, elPanel);
                }
            };
            const tempCreatedItem = InspectShared.GetPopupSetting('temp_display_item_id');
            btnHoldAction.SetPanelEvent('onmouseover', () => {
                UiToolkitAPI.ShowCustomLayoutParametersTooltip(btnHoldAction.id, 'tooltip-souvenir-receipt', 'file://{resources}/layout/tooltips/tooltip_souvenir_receipt.xml', 'itemid=' + tempCreatedItem);
            });
            btnHoldAction.SetPanelEvent('onmouseout', () => {
                UiToolkitAPI.HideCustomLayoutTooltip('tooltip-souvenir-receipt');
            });
            HoldButton.SetupButton(btnSettings);
            btnHoldAction.enabled = true;
            _DiscountPanel(oSettings.popup_panel, elPanel);
            const umidSouvenir = InspectShared.GetPopupSetting('umid_souvenir');
            const elButtonChangeSouvenirItem = elPanel.FindChildInLayoutFile('ChangeSouvenirItem');
            elButtonChangeSouvenirItem.RemoveClass('hidden');
            elButtonChangeSouvenirItem.SetPanelEvent('onactivate', () => {
                $.DispatchEvent('CSGOPlaySoundEffect', 'sticker_applySticker', 'MOUSE');
                _ClosePopup();
                $.DispatchEvent('ShowSelectItemForCapabilityPopup', umidSouvenir, '', 'craft_souvenir');
            });
            const elMakeSouvenirPlayerSelect = elPanel.FindChildInLayoutFile('MakeSouvenirPlayerSelect');
            elMakeSouvenirPlayerSelect.RemoveClass('hidden');
            const goldenItemId = InspectShared.GetPopupSetting('temp_display_item_id');
            const unTeamIDs = [InventoryAPI.GetItemAttributeValue(goldenItemId, '{uint32}tournament event team0 id'),
                InventoryAPI.GetItemAttributeValue(goldenItemId, '{uint32}tournament event team1 id')];
            const unPlayerID = InventoryAPI.GetItemAttributeValue(goldenItemId, '{uint32}tournament mvp account id');
            let arrSelections = [];
            const defidxStickerItem = InventoryAPI.GetItemDefinitionIndexFromDefinitionName('sticker');
            g_ActiveTournamentTeams.filter((tt) => unTeamIDs.includes(tt.teamid)).forEach((tt) => {
                tt.players.forEach((tp) => {
                    let sPlayerName = $.Localize('#SFUI_ProPlayer_' + tp.code, elPanel).split(" ");
                    sPlayerName.splice(1, 0, ...["'" + tp.nick + "'"]);
                    const idFauxSticker = InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(defidxStickerItem, tp.stickerids[tp.stickerids.length - 1]);
                    let unCostInCredits = MissionsAPI.GetSeasonalOperationFauxCreditsCost(g_ActiveTournamentInfo.credits_id, idFauxSticker);
                    arrSelections.push({
                        unPlayerID: tp.playerid,
                        sPlayerName: sPlayerName.join(" "),
                        sTeamTag: tt.team,
                        unCostInCredits: unCostInCredits,
                        unStickerID: tp.stickerids[tp.stickerids.length - 1]
                    });
                });
            });
            arrSelections.sort((a, b) => (a.unCostInCredits - b.unCostInCredits) * 100000 + (a.unStickerID - b.unStickerID));
            arrSelections.forEach((sel) => {
                let elOption = $.CreatePanel('Panel', elMakeSouvenirPlayerSelect, 'id-MakeSouvenirPlayerSelect-p' + sel.unPlayerID);
                elOption.BLoadLayoutSnippet('craft-souvenir-dropdown-select-player-entry');
                let elNamePanel = elOption.FindChildInLayoutFile('id-craft-souvenir-dropdown-select-player-entry-name');
                elNamePanel.text = sel.sPlayerName;
                elOption.FindChildInLayoutFile('id-craft-souvenir-dropdown-select-player-entry-cost')
                    .SetDialogVariableInt('cost', sel.unCostInCredits);
                elOption.FindChildInLayoutFile('id-team-player-logo')
                    .SetImage("file://{images}/tournaments/teams/" + sel.sTeamTag + ".svg");
                elOption.SetAttributeUInt32('playerid', sel.unPlayerID);
                if (sel.unPlayerID != unPlayerID) {
                    elNamePanel.SetPanelEvent('onactivate', () => {
                        $.DispatchEvent("Activated", elNamePanel.GetParent(), "mouse");
                    });
                }
                else {
                    elOption.AddClass('craft_souvenir_dropdown_selected');
                }
                elMakeSouvenirPlayerSelect.AddOption(elOption);
            });
            elMakeSouvenirPlayerSelect.SetPanelEvent('oninputsubmit', () => {
                const elSelected = elMakeSouvenirPlayerSelect.GetSelected();
                const nNewPlayerID = elSelected.GetAttributeUInt32('playerid', 0);
                if (nNewPlayerID && unPlayerID != nNewPlayerID) {
                    let oNewSettings = {
                        item_id: itemId,
                        tool_id: '',
                        umid_souvenir: 'pid_' + nNewPlayerID + ':' + (umidSouvenir.split(':').pop()),
                        work_type: 'craft_souvenir'
                    };
                    _ClosePopup();
                    const elPanel = UiToolkitAPI.ShowCustomLayoutPopup('popup-inspect-' + itemId, 'file://{resources}/layout/popups/popup_capability_can_keychain.xml');
                    elPanel.AddClass('PopupPanelCapability_' + oNewSettings.work_type);
                    elPanel.Data().oSettings = oNewSettings;
                }
            });
            elMakeSouvenirPlayerSelect.SetSelected('id-MakeSouvenirPlayerSelect-p' + unPlayerID);
            return;
        }
        if (worktype === 'remove_keychain') {
            elOK.visible = false;
            elNegative.visible = false;
            const btnHoldAction = elPanel.FindChildInLayoutFile('AsyncItemWorkAcceptNegativeHold');
            btnHoldAction.RemoveClass('AsyncItemWorkAcceptNegativeHidden');
            const btnSettings = {
                btn: btnHoldAction,
                tooltip: '#SFUI_Keychain_Remove_Tooltip',
                locString: '#popup_' + worktype + '_button',
                loopingSound: 'UI.Laptop.ButtonFillLoop',
                timerCompleteAction: () => {
                    _OnAccept(oSettings, elPanel);
                    btnHoldAction.enabled = false;
                }
            };
            HoldButton.SetupButton(btnSettings);
            return;
        }
        if (worktype === 'remove_patch') {
            elOK.visible = false;
            elNegative.visible = false;
            const btnHoldAction = elPanel.FindChildInLayoutFile('AsyncItemWorkAcceptNegativeHold');
            btnHoldAction.RemoveClass('AsyncItemWorkAcceptNegativeHidden');
            const btnSettings = {
                btn: btnHoldAction,
                tooltip: '#SFUI_Patch_Remove_Desc_Tooltip',
                locString: '#popup_' + worktype + '_button',
                loopingSound: 'UI.Laptop.ButtonFillLoop',
                timerCompleteAction: () => {
                    _OnAccept(oSettings, elPanel);
                    btnHoldAction.enabled = false;
                }
            };
            HoldButton.SetupButton(btnSettings);
            return;
        }
        if (worktype === 'remove_sticker') {
            const bRemovingAllStickersForSouvenir = !!InspectShared.GetPopupSetting('remove_sticker_all_at_once');
            if (bRemovingAllStickersForSouvenir)
                elOK.visible = false;
            elNegative.visible = false;
            const btnHoldAction = elPanel.FindChildInLayoutFile('AsyncItemWorkAcceptNegativeHold');
            btnHoldAction.RemoveClass('AsyncItemWorkAcceptNegativeHidden');
            const btnSettings = {
                btn: btnHoldAction,
                tooltip: bRemovingAllStickersForSouvenir ? '#SFUI_Sticker_WipeStickersImmediate_Tooltip' : '#SFUI_Sticker_RemoveImmediate_Tooltip',
                locString: '#popup_' + worktype + '_button_negative' + (bRemovingAllStickersForSouvenir ? '_wipestickers' : ''),
                loopingSound: 'UI.Laptop.ButtonFillLoop',
                timerCompleteAction: () => {
                    _OnAccept(oSettings, elPanel, true);
                    btnHoldAction.enabled = false;
                }
            };
            HoldButton.SetupButton(btnSettings);
        }
        if (worktype === 'delete') {
            elNegative.visible = false;
            elOK.visible = false;
            const btnHoldAction = elPanel.FindChildInLayoutFile('AsyncItemWorkAcceptNegativeHold');
            btnHoldAction.RemoveClass('AsyncItemWorkAcceptNegativeHidden');
            const btnSettings = {
                btn: btnHoldAction,
                tooltip: '#popup_delete_tooltip',
                locString: '#popup_' + worktype + '_button',
                loopingSound: 'UI.Laptop.ButtonFillLoop',
                timerCompleteAction: () => {
                    _OnAccept(oSettings, elPanel, true);
                    btnHoldAction.enabled = false;
                }
            };
            HoldButton.SetupButton(btnSettings);
            return;
        }
        const toolId = InspectShared.GetPopupSetting('tool_id');
        const itemDefName = InventoryAPI.GetItemDefinitionName(itemId);
        const btnStyle = InspectShared.GetPopupSetting('override_async_btn_style') === false ?
            'Positive' :
            InspectShared.GetPopupSetting('override_async_btn_style');
        if (worktype === 'decodeable') {
            const sRestriction = InventoryAPI.GetDecodeableRestriction(itemId);
            const elDescLabel = elPanel.FindChildInLayoutFile('AsyncItemWorkDesc');
            const elDescImage = elPanel.FindChildInLayoutFile('AsyncItemWorkDescImage');
            const inspectOnly = InspectShared.GetPopupSetting('inspect_only');
            if (inspectOnly || sRestriction === 'restricted') {
                elOK.visible = false;
                elDescLabel.visible = false;
                elDescImage.visible = false;
                return;
            }
            if (InspectShared.GetPopupSetting('is_xray_machine')) {
                const enabled = InspectShared.GetPopupSetting('allow_xray_claim') ? true : false;
                EnableDisableOkBtn(elPanel, enabled);
                elOK.AddClass(btnStyle);
                elOK.text = '#popup_xray_claim_item';
                _SetPanelEventOnAccept();
                return;
            }
            if (sRestriction === 'xray' && !inspectOnly) {
                elOK.visible = true;
                elOK.text = '#popup_xray_button_goto';
                elOK.AddClass(btnStyle);
                elOK.SetPanelEvent('onactivate', () => {
                    $.DispatchEvent("ShowXrayCasePopup", !toolId ? '' : toolId, itemId, true);
                    _ClosePopup();
                });
                elDescLabel.visible = true;
                elDescLabel.text = '#popup_decodeable_async_xray_desc';
                elDescImage.visible = false;
                return;
            }
            const terminalValue = InventoryAPI.GetItemAttributeValue(itemId, '{uint32}volatile container');
            const isTerminal = (terminalValue == '' || terminalValue == undefined || terminalValue == 0) ? false : true;
            if (itemDefName && itemDefName.indexOf("spray") != -1)
                sOkButtonText = sOkButtonText + "_graffiti";
            else if (itemDefName && itemDefName.indexOf("tournament_pass_") != -1)
                sOkButtonText = sOkButtonText + "_fantoken";
            else if (terminalValue)
                sOkButtonText = sOkButtonText + "_terminal";
            const elDropdown = elPanel.FindChildInLayoutFile('AsyncOfferLimitDropdown');
            elDropdown.SetHasClass('hidden', !isTerminal);
            if (isTerminal)
                _SetUpOfferLimitDropdown(elDropdown);
        }
        if (worktype === 'can_sticker') {
            const listStickers = ItemInfo.GetitemStickerList(itemId);
            elOK.SetDialogVariableInt('sticker_count', listStickers.length + 1);
            elOK.SetDialogVariableInt('max_stickers', 5);
        }
        if (worktype === 'nameable' && itemDefName === 'casket') {
            sOkButtonText = '#popup_newcasket_button';
        }
        if (worktype === 'useitem') {
            if (itemDefName && itemDefName.startsWith('Remove Keychain Tool')) {
                elOK.SetDialogVariableInt('item_count', Number(InventoryAPI.GetItemAttributeValue(itemId, '{uint32}items count')));
                sOkButtonText = '#popup_useitem_button_getkeychaincharges:f';
            }
            if (itemDefName && itemDefName.startsWith('XpShopTicket')) {
                const bHasPrime = FriendsListAPI.GetFriendPrimeEligible(MyPersonaAPI.GetXuid());
                sOkButtonText = bHasPrime ? '#xpshop_pass_activate_open_armory' : '#SFUI_Elevated_Status_upgrade_status';
            }
            if (itemDefName?.includes('tournament_pass_') && itemDefName?.includes('_credits')) {
                $.GetContextPanel().Data().majorCreditsToClaim = Number(InventoryAPI.GetItemAttributeValue(itemId, '{uint32}upgrade level'));
            }
        }
        elOK.text = sOkButtonText;
        elOK.AddClass(btnStyle);
        _SetPanelEventOnAccept();
    }
    function _DiscountPanel(popup_panel, elAsyncBar) {
        const oPriceData = _ComputeTotalSouvenirCost(popup_panel);
        const elDiscount = elAsyncBar.FindChildInLayoutFile('id-souvenir-discount');
        if (oPriceData.discountAmount > 0) {
            elDiscount.SetHasClass('hidden', false);
            elDiscount.SetDialogVariableInt('discount', oPriceData.discountAmount);
            elDiscount.SetDialogVariableInt('price', oPriceData.discountPrice);
            elDiscount.SetDialogVariableInt('original-price', oPriceData.originalPrice);
        }
        else
            elDiscount.SetHasClass('hidden', true);
    }
    function _SetUpOfferLimitDropdown(elDropdown) {
        const oLimits = JSON.parse(InventoryAPI.GetVolatileLimits());
        for (let i = 0; i < oLimits.choices.length; i++) {
            if (!elDropdown.HasOption('id-dropdown-limit-' + oLimits.choices[i].limit)) {
                let elOption = $.CreatePanel('Label', elDropdown, 'id-dropdown-limit-' + oLimits.choices[i].limit, {
                    class: 'DropDownMenu'
                });
                elOption.SetDialogVariable('limit', $.Localize(oLimits.choices[i].label));
                elOption.text = $.Localize('#offer_limit_setting', elOption);
                elOption.SetAttributeUInt32('limit', oLimits.choices[i].limit);
                elDropdown.AddOption(elOption);
            }
        }
        elDropdown.SetPanelEvent('oninputsubmit', () => _OnOfferLimitDropdownSubmit(elDropdown));
        elDropdown.SetSelected('id-dropdown-limit-' + oLimits.limit);
    }
    function _OnOfferLimitDropdownSubmit(elDropdown) {
        const elSelected = elDropdown.GetSelected();
        const nLimit = elSelected.GetAttributeUInt32('limit', 0);
        InventoryAPI.SetVolatileLimits(nLimit);
    }
    function _SetUpDescription(elPanel) {
        const elDescLabel = elPanel.FindChildInLayoutFile('AsyncItemWorkDesc');
        const elDescImage = elPanel.FindChildInLayoutFile('AsyncItemWorkDescImage');
        const worktype = InspectShared.GetPopupSetting('work_type');
        const toolId = InspectShared.GetPopupSetting('tool_id');
        const showAsyncActionDesc = InspectShared.GetPopupSetting('override_async_bar_desc');
        const showXrayMachineUi = InspectShared.GetPopupSetting('is_xray_machine');
        elDescLabel.SetHasClass('popup-capability-faded', showXrayMachineUi && !InspectShared.GetPopupSetting('allow_xray_claim'));
        elDescImage.SetHasClass('popup-capability-faded', showXrayMachineUi && !InspectShared.GetPopupSetting('allow_xray_claim'));
        if (showAsyncActionDesc) {
            elDescImage.itemid = toolId;
            const itemName = InventoryAPI.GetItemName(toolId);
            if (itemName) {
                elDescLabel.SetDialogVariable('itemname', itemName);
                elDescLabel.text = $.Localize('#popup_' + worktype + '_async_desc', elDescLabel);
            }
        }
        elDescLabel.visible = showAsyncActionDesc;
    }
    function EnableDisableOkBtn(elPanel, bEnable) {
        const elOK = elPanel.FindChildInLayoutFile('AsyncItemWorkAcceptConfirm');
        if (elOK.visible) {
            if (elOK.enabled !== bEnable)
                elOK.TriggerClass('popup-capability-update-anim');
            elOK.enabled = bEnable;
        }
        let elNegative = elPanel.FindChildInLayoutFile('AsyncItemWorkAcceptNegative');
        if (elNegative && elNegative.visible) {
            if (elNegative.enabled !== bEnable)
                elNegative.TriggerClass('popup-capability-update-anim');
            elNegative.enabled = bEnable;
        }
        elNegative = elPanel.FindChildInLayoutFile('AsyncItemWorkAcceptNegativeHold');
        if (elNegative && elNegative.visible) {
            if (elNegative.enabled !== bEnable)
                elNegative.TriggerClass('popup-capability-update-anim');
            elNegative.enabled = bEnable;
        }
    }
    InspectAsyncActionBar.EnableDisableOkBtn = EnableDisableOkBtn;
    function ShowHideOkBtn(elPanel, bShow) {
        const elOK = elPanel.FindChildInLayoutFile('AsyncItemWorkAcceptConfirm');
        elOK.SetHasClass('move-down', !bShow);
        let elNegative = elPanel.FindChildInLayoutFile('AsyncItemWorkAcceptNegative');
        if (elNegative)
            elNegative.SetHasClass('move-down', !bShow);
        elNegative = elPanel.FindChildInLayoutFile('AsyncItemWorkAcceptNegativeHold');
        if (elNegative)
            elNegative.SetHasClass('move-down', !bShow);
    }
    InspectAsyncActionBar.ShowHideOkBtn = ShowHideOkBtn;
    function _OnAccept(oSettings, elAsyncActionBarPanel, bForceRemoveSticker = false) {
        ResetTimeouthandle();
        const worktype = oSettings.work_type;
        const itemId = oSettings.item_id;
        if (worktype === 'useitem') {
            if (ItemInfo.ItemDefinitionNameSubstrMatch(itemId, 'XpShopTicket')) {
                const bHasPrime = FriendsListAPI.GetFriendPrimeEligible(MyPersonaAPI.GetXuid());
                if (!bHasPrime) {
                    UiToolkitAPI.ShowCustomLayoutPopup('prime_status', 'file://{resources}/layout/popups/popup_prime_status.xml');
                    return;
                }
                const oXpShopTrackProgress = InventoryAPI.GetCacheTypeElementJSOByIndex('XpShop', 0);
                const bTooManyTracks = (oXpShopTrackProgress && (oXpShopTrackProgress.xp_tracks.length >= StoreAPI.GetXpShopMaxTracks()));
                if (bTooManyTracks) {
                    UiToolkitAPI.ShowGenericPopupOk('#CSGO_Purchasable_XpShop_Ticket', '#CSGO_Purchasable_XpShop_Ticket_TooManyTracks', '', () => { });
                    return;
                }
                ResetTimeouthandle();
                _ClosePopup();
                $.DispatchEvent('MainMenuGoToStore', 'id-store-nav-xpshop');
                return;
            }
        }
        if (worktype === 'useitem' || worktype === 'decodeable') {
            const strToolType = InventoryAPI.GetToolType(itemId);
            if (strToolType === 'fantoken') {
                const nTournamentEventID = InventoryAPI.GetItemAttributeValue(itemId, '{uint32}tournament event id');
                if (nTournamentEventID && (nTournamentEventID > 0)) {
                    const coinItemId = InventoryAPI.GetActiveTournamentCoinItemId(nTournamentEventID);
                    if (coinItemId && (coinItemId !== '0')) {
                        $.DispatchEvent('CSGOPlaySoundEffect', 'sticker_applyConfirm', 'MOUSE');
                        UiToolkitAPI.ShowGenericPopupOk(InventoryAPI.GetItemName(coinItemId), '#Store_DuplicateItemInBackpack', '', () => {
                            ResetTimeouthandle();
                            _ClosePopup();
                            $.DispatchEvent("ShowCustomLayoutPopupParametersAsEvent", '', 'file://{resources}/layout/popups/popup_inventory_inspect.xml', 'item_id=' + coinItemId +
                                ',inspect_only=true,force_inspect_view_type=primary');
                        });
                        return;
                    }
                }
            }
        }
        _PerformAsyncAction(oSettings, bForceRemoveSticker);
        if (worktype === 'craft_souvenir')
            return;
        let elNegative = elAsyncActionBarPanel.FindChildInLayoutFile('AsyncItemWorkAcceptNegative');
        if (elNegative)
            elNegative.AddClass('hidden');
        elNegative = elAsyncActionBarPanel.FindChildInLayoutFile('AsyncItemWorkAcceptNegativeHold');
        if (elNegative)
            elNegative.AddClass('hidden');
        elAsyncActionBarPanel.FindChildInLayoutFile('NameableSpinner').RemoveClass('hidden');
        elAsyncActionBarPanel.FindChildInLayoutFile('AsyncItemWorkAcceptConfirm').AddClass('hidden');
    }
    function _ShowHideInspectViewButtons(elAsyncActionBarPanel) {
        const worktype = InspectShared.GetPopupSetting('work_type');
        if (worktype === 'can_sticker' || worktype === 'can_keychain') {
            const elApplyPickSlot = $.GetContextPanel().FindChildInLayoutFile('PopUpCanApplyPickSlot');
            elAsyncActionBarPanel.FindChildInLayoutFile('InspectWeaponBtn').SetPanelEvent('onactivate', () => {
                InspectModelImage.EndWeaponLookat();
                CanApplyPickSlot.ShowHideInfoPanel(false, elApplyPickSlot);
                CanApplyPickSlot.IsContinueEnabled(elApplyPickSlot);
                ShowHideOkBtn(elAsyncActionBarPanel, true);
                EnableDisableOkBtn(elAsyncActionBarPanel, !CanApplyPickSlot.IsContinueEnabled(elApplyPickSlot));
                elAsyncActionBarPanel.FindChildInLayoutFile('AsyncItemWorkCancelBtn').text = "#GameUI_Close";
                if (elAsyncActionBarPanel.FindChildInLayoutFile('InspectItemModelZoom').visible) {
                    elAsyncActionBarPanel.FindChildInLayoutFile('InspectItemModelZoom').enabled = true;
                }
            });
            elAsyncActionBarPanel.FindChildInLayoutFile('LookatWeaponBtn').SetPanelEvent('onactivate', () => {
                InspectModelImage.StartWeaponLookat();
                CanApplyPickSlot.ShowHideInfoPanel(true, elApplyPickSlot);
                ShowHideOkBtn(elAsyncActionBarPanel, false);
                EnableDisableOkBtn(elAsyncActionBarPanel, false);
                elAsyncActionBarPanel.FindChildInLayoutFile('AsyncItemWorkCancelBtn').text = "#SFUI_Back";
                elAsyncActionBarPanel.FindChildInLayoutFile('InspectItemModelZoom').enabled = false;
            });
            elAsyncActionBarPanel.FindChildInLayoutFile('InspectWeaponBtn').GetParent().SetHasClass('hidden', false);
        }
        else {
            elAsyncActionBarPanel.FindChildInLayoutFile('InspectWeaponBtn').GetParent().SetHasClass('hidden', true);
        }
        elAsyncActionBarPanel.FindChildInLayoutFile('ChangeScenery').SetHasClass('hidden', worktype === 'decodeable' || worktype === 'remove_patch'
            || worktype === 'can_wrap_sticker' || worktype === 'craft_souvenir'
            || worktype === 'remove_sticker' || worktype === 'remove_keychain');
    }
    function _ChangeSceneryBtn(elAsyncActionBarPanel) {
        elAsyncActionBarPanel.FindChildInLayoutFile('ChangeScenery').SetPanelEvent('onactivate', UpdateScenery);
    }
    function UpdateScenery() {
        UiToolkitAPI.ShowCustomLayoutContextMenuParametersDismissEvent('id-inspect-contextmenu-maps', '', 'file://{resources}/layout/context_menus/context_menu_mainmenu_vanity.xml', 'type=maps' +
            '&' + 'inspect-map=true', () => { $.DispatchEvent('ContextMenuEvent', ''); });
    }
    InspectAsyncActionBar.UpdateScenery = UpdateScenery;
    function EnableDisableChangeSceneryBtn(bEnable, elAsyncActionBarPanel) {
        elAsyncActionBarPanel.FindChildInLayoutFile('ChangeScenery').enabled = bEnable;
    }
    InspectAsyncActionBar.EnableDisableChangeSceneryBtn = EnableDisableChangeSceneryBtn;
    function _ShowZoomBtn(elAsyncActionBarPanel) {
        if (InspectModelImage.PanZoomEnabled() || InspectShared.GetPopupSetting('work_type') === 'nameable')
            return;
        const defName = InventoryAPI.GetItemDefinitionName(InspectShared.GetPopupSetting('item_id'));
        const result = InspectModelImage.m_CameraSettingsPerWeapon.find(({ type }) => type === defName);
        if (!result || !result.hasOwnProperty('zoom_camera'))
            return;
        const elZoomBtn = elAsyncActionBarPanel.FindChildInLayoutFile('InspectItemModelZoom');
        elZoomBtn.SetPanelEvent('onactivate', () => ZoomCamera(false, elAsyncActionBarPanel));
        elZoomBtn.SetHasClass('hidden', false);
    }
    function ZoomCamera(bForceZoomOut = false, elAsyncActionBarPanel) {
        const elZoomButton = elAsyncActionBarPanel.FindChildInLayoutFile('InspectItemModelZoom');
        if (bForceZoomOut) {
            InspectModelImage.ZoomCamera(false);
            elZoomButton.checked = false;
            return;
        }
        if (elZoomButton.checked) {
            InspectModelImage.ZoomCamera(true);
        }
        else {
            InspectModelImage.ZoomCamera(false);
        }
    }
    InspectAsyncActionBar.ZoomCamera = ZoomCamera;
    function OnCloseRemove(elAsyncActionBarPanel) {
        if (elAsyncActionBarPanel.IsValid()) {
            elAsyncActionBarPanel.FindChildInLayoutFile('NameableSpinner').AddClass('hidden');
            elAsyncActionBarPanel.FindChildInLayoutFile('AsyncItemWorkAcceptConfirm').RemoveClass('hidden');
            let elNegative = elAsyncActionBarPanel.FindChildInLayoutFile('AsyncItemWorkAcceptNegative');
            if (elNegative)
                elNegative.RemoveClass('hidden');
            elNegative = elAsyncActionBarPanel.FindChildInLayoutFile('AsyncItemWorkAcceptNegativeHold');
            if (elNegative)
                elNegative.RemoveClass('hidden');
        }
    }
    InspectAsyncActionBar.OnCloseRemove = OnCloseRemove;
    function _ClosePopup() {
        ResetTimeouthandle();
        HoldButton.StopLoopingSound('UI.Laptop.ButtonFillLoop');
        $.DispatchEvent('HideSelectItemForCapabilityPopup');
        $.DispatchEvent('UIPopupButtonClicked', '');
        $.DispatchEvent('CapabilityPopupIsOpen', false);
    }
    function SetCallbackTimeout() {
        const elPanel = $.GetContextPanel();
        m_scheduleHandle = $.Schedule(5, () => _CancelWaitforCallBack(elPanel));
    }
    InspectAsyncActionBar.SetCallbackTimeout = SetCallbackTimeout;
    function _CancelWaitforCallBack(elPanel) {
        m_scheduleHandle = null;
        const elSpinner = elPanel.FindChildInLayoutFile('NameableSpinner');
        elSpinner.AddClass('hidden');
        _ClosePopup();
        UiToolkitAPI.ShowGenericPopupOk($.Localize('#SFUI_SteamConnectionErrorTitle'), $.Localize('#SFUI_InvError_Item_Not_Given'), '', () => { });
    }
    function OnEventToClose() {
        const worktype = InspectShared.GetPopupSetting('work_type');
        const elAsyncActionBarPanel = $.GetContextPanel().FindChildInLayoutFile('PopUpInspectAsyncBar');
        if (_DefaultZoomView(worktype, elAsyncActionBarPanel) === false)
            _ClosePopup();
    }
    InspectAsyncActionBar.OnEventToClose = OnEventToClose;
    function _DefaultZoomView(worktype, elAsyncActionBarPanel) {
        if (elAsyncActionBarPanel && (worktype === 'can_sticker' || worktype === 'can_keychain')) {
            const elLookatBtn = elAsyncActionBarPanel.FindChildInLayoutFile('LookatWeaponBtn');
            if (elLookatBtn && elLookatBtn.IsValid()
                && elLookatBtn.checked
                && m_scheduleHandle === null) {
                $.DispatchEvent("Activated", elAsyncActionBarPanel.FindChildInLayoutFile('InspectWeaponBtn'), "mouse");
                return true;
            }
        }
        return false;
    }
    function ResetTimeouthandle() {
        if (m_scheduleHandle) {
            $.CancelScheduled(m_scheduleHandle);
            m_scheduleHandle = null;
        }
    }
    InspectAsyncActionBar.ResetTimeouthandle = ResetTimeouthandle;
    function _OnItemCustomization(numericType, type, itemid, cp = $.GetContextPanel()) {
        const worktype = InspectShared.GetPopupSetting('work_type');
        if (_IgnoreClose()) {
            ResetTimeouthandle();
            return;
        }
        if (worktype === 'craft_souvenir' && type === 'reward_redeemed') {
            _ClosePopup();
            return;
        }
        if (type === 'xp_shop_use_ticket' || type === 'xp_shop_ack_tracks') {
        }
        else if (type === 'keychain_tool_charges' && worktype === 'useitem') {
            const defidxContract = InventoryAPI.GetItemDefinitionIndexFromDefinitionName("Remove Keychain Tool");
            const fauxItemID = InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(defidxContract, 0);
            $.DispatchEvent("ShowCustomLayoutPopupParametersAsEvent", '', 'file://{resources}/layout/popups/popup_inventory_inspect.xml', 'item_id=' + fauxItemID +
                ',' + 'inspect_only=true');
        }
        else if (type === 'seasontiers') {
            if (worktype === 'useitem') {
                const popupPanel = UiToolkitAPI.ShowCustomLayoutPopup('id-popup-major-store', 'file://{resources}/layout/popups/popup_major_store.xml');
                popupPanel.Data().activatedCredits = cp.Data().majorCreditsToClaim;
            }
            else {
                return;
            }
        }
        else {
            $.DispatchEvent('ShowAcknowledgePopup', type, itemid);
        }
        OnEventToClose();
    }
    function _IgnoreClose() {
        return InspectShared.GetPopupSetting('work_type') === 'decodeable';
    }
    function _ComputeTotalSouvenirCost(cp, itemIdSouvenir) {
        const tempCreatedItem = itemIdSouvenir ?? InspectShared.GetPopupSetting('temp_display_item_id');
        let nTotalCostInCredits = 0;
        {
            const defidxStickerItem = InventoryAPI.GetItemDefinitionIndexFromDefinitionName('sticker');
            for (let i = 0; i < 6; ++i) {
                const idStickerKit = InventoryAPI.GetItemAttributeValue(tempCreatedItem, '{uint32}sticker slot ' + i + ' id');
                if (!idStickerKit)
                    continue;
                const idFauxSticker = InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(defidxStickerItem, idStickerKit);
                const unCostInCredits = MissionsAPI.GetSeasonalOperationFauxCreditsCost(g_ActiveTournamentInfo.credits_id, idFauxSticker);
                if (unCostInCredits)
                    nTotalCostInCredits += unCostInCredits;
                else
                    nTotalCostInCredits += g_ActiveTournamentInfo.souvenir_cost;
            }
        }
        const discountAmount = InventoryAPI.GetItemSouvenirDiscountPercent(tempCreatedItem);
        const discountCredits = Math.trunc(nTotalCostInCredits * discountAmount / 100);
        let discountPrice = nTotalCostInCredits;
        if (discountCredits < nTotalCostInCredits)
            discountPrice -= discountCredits;
        return { discountPrice: discountPrice, originalPrice: nTotalCostInCredits, discountAmount: discountAmount };
    }
    let m_SouvenirCheckoutCart = ShoppingCart.cart;
    function _OnVolatileShopSubscribe(nContainerDef, bNewPricesParsed, cp) {
        const nTotalCostInCredits = _ComputeTotalSouvenirCost(cp).discountPrice;
        if (m_SouvenirCheckoutCart !== ShoppingCart.cart) {
            m_SouvenirCheckoutCart.syncPrices((itemId) => {
                return nTotalCostInCredits;
            });
        }
        let oApplySettings = {
            headerPanel: $.GetContextPanel().FindChildInLayoutFile('PopUpCanApplyHeader'),
            infoPanel: $.GetContextPanel().FindChildInLayoutFile('PopUpCanApplyPickSlot'),
            asyncBarPanel: $.GetContextPanel().FindChildInLayoutFile('PopUpInspectAsyncBar'),
            contextPanel: $.GetContextPanel(),
            itemId: InspectShared.GetPopupSetting('temp_display_item_id') ? InspectShared.GetPopupSetting('temp_display_item_id') : InspectShared.GetPopupSetting('item_id'),
            toolId: InspectShared.GetPopupSetting('tool_id'),
            isRemove: false,
            type: '',
            funcOnConfirm: () => { },
            funcOnNext: () => { },
            funcOnCancel: () => { },
            funcOnSelectForRemove: () => { }
        };
        CanApplyPickSlot.Init(oApplySettings);
        _DiscountPanel(oApplySettings.contextPanel, oApplySettings.asyncBarPanel);
    }
    function _OnMyPersonaInventoryUpdated() {
        if (InspectShared.GetPopupSetting('is_season_pass') && InventoryAPI.IsValidItemID(InspectShared.GetPopupSetting('item_id'))) {
            return;
        }
        const worktype = InspectShared.GetPopupSetting('work_type');
        if (worktype === "remove_sticker" ||
            worktype === "remove_patch" ||
            worktype === "remove_keychain" ||
            worktype === "can_sticker" ||
            worktype === "can_wrap_sticker" ||
            worktype === "craft_souvenir" ||
            worktype === "can_patch" ||
            worktype === "can_keychain" ||
            worktype === "useitem" ||
            worktype === "nameable") {
            return;
        }
        OnEventToClose();
    }
    function _OnInventoryPrestigeCoinResponse(defidx, upgradeid, hours, prestigetime) {
        OnEventToClose();
        if (InspectShared.GetPopupSetting('work_type') === 'prestigecheck') {
            const elPanel = UiToolkitAPI.ShowCustomLayoutPopup('', 'file://{resources}/layout/popups/popup_inventory_inspect.xml');
            let oSettings = {
                item_id: InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(defidx, 0),
                show_work_type_warning: false,
                work_type: (upgradeid === '0') ? 'prestigeget' : 'prestigeupgrade'
            };
            elPanel.Data().oSettings = oSettings;
        }
        else if (upgradeid !== '0') {
            InventoryAPI.AcknowledgeNewItembyItemID(upgradeid);
            InventoryAPI.SetItemSessionPropertyValue(upgradeid, 'recent', '1');
            $.DispatchEvent('InventoryItemPreview', upgradeid, '');
        }
    }
})(InspectAsyncActionBar || (InspectAsyncActionBar = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9wdXBfaW5zcGVjdF9hc3luYy1iYXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9jb250ZW50L2NzZ28vcGFub3JhbWEvc2NyaXB0cy9wb3B1cHMvcG9wdXBfaW5zcGVjdF9hc3luYy1iYXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLHFDQUFxQztBQUNyQyxpREFBaUQ7QUFDakQsOENBQThDO0FBQzlDLHNDQUFzQztBQUN0QyxnREFBZ0Q7QUFDaEQscURBQXFEO0FBQ3JELDRFQUE0RTtBQUM1RSxtREFBbUQ7QUFFbkQsSUFBVSxxQkFBcUIsQ0FtdUM5QjtBQW51Q0QsV0FBVSxxQkFBcUI7SUFFOUIsSUFBSSxnQkFBZ0IsR0FBa0IsSUFBSSxDQUFDO0lBRTNDLFNBQWdCLElBQUk7UUFFbkIsTUFBTSxRQUFRLEdBQUcsYUFBYSxDQUFDLGVBQWUsQ0FBRSxXQUFXLENBQUUsQ0FBQztRQUM5RCxNQUFNLE1BQU0sR0FBRyxhQUFhLENBQUMsZUFBZSxDQUFFLFNBQVMsQ0FBRSxDQUFDO1FBQzFELE1BQU0saUJBQWlCLEdBQUcsYUFBYSxDQUFDLGVBQWUsQ0FBRSxpQkFBaUIsQ0FBRSxDQUFDO1FBQzdFLE1BQU0sV0FBVyxHQUFHLGFBQWEsQ0FBQyxlQUFlLENBQUUsWUFBWSxDQUFFLENBQUM7UUFDbEUsTUFBTSxxQkFBcUIsR0FBRyxDQUFDLENBQUMsZUFBZSxFQUFFLENBQUMscUJBQXFCLENBQUUsc0JBQXNCLENBQUUsQ0FBQztRQUVsRyxDQUFDLENBQUMsZUFBZSxFQUFFLENBQUMsUUFBUSxDQUFFLHVCQUF1QixHQUFHLFFBQVEsQ0FBRSxDQUFDO1FBSW5FLElBQUssYUFBYSxDQUFDLGVBQWUsQ0FBRSxzQkFBc0IsQ0FBRTtZQUMzRCxDQUFDLFFBQVE7WUFDVCxDQUFFLFdBQVcsSUFBSSxDQUFDLGlCQUFpQixDQUFFO1lBQ3JDLENBQUUsUUFBUSxLQUFLLFVBQVUsSUFBSSxDQUFDLE1BQU0sQ0FBRTtZQUN0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