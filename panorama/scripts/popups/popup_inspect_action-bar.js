"use strict";
/// <reference path="../csgo.d.ts" />
/// <reference path="../common/item_context_entries.ts" />
/// <reference path="../inspect.ts" />
/// <reference path="../characterbuttons.ts" />
/// <reference path="../common/shopping_cart.ts" />
var InspectActionBar;
(function (InspectActionBar) {
    function Init() {
        const elActionBar = $.GetContextPanel().FindChildInLayoutFile('PopUpInspectActionBar');
        if (!InspectShared.GetPopupSetting('inspect_only')) {
            elActionBar.AddClass('hidden');
            return;
        }
        elActionBar.Data().schfnMusicMvpPreviewEnd = null;
        elActionBar.Data().previewingMusic = false;
        elActionBar.RemoveClass('hidden');
        elActionBar.Data().panelRegisteredForEvents = false;
        const itemId = InspectShared.GetPopupSetting('item_id');
        _SetUpItemCertificate(elActionBar, itemId);
        _SetupEquipItemBtns(elActionBar, itemId);
        _ShowButtonsForWeaponInspect(elActionBar, itemId);
        _ShowButtonsForCharacterInspect(elActionBar, itemId);
        _SetCloseBtnAction(elActionBar, $.GetContextPanel());
        _SetUpMarketLink(elActionBar, itemId);
        _SetUpOpenSeasonStatsAction(elActionBar, $.GetContextPanel(), itemId);
        _SetUpViewHighlightReelAction(elActionBar, itemId);
        const nPrice = InspectShared.GetPopupSetting('price_in_tokens');
        _SetupAddRemoveToCartButtons(elActionBar, itemId, nPrice);
        _SetupCartActionsBtn(elActionBar, nPrice, itemId);
        _ShowHideCartBtn(elActionBar, nPrice);
        _ShowHideFavoriteBtn($.GetContextPanel(), elActionBar, nPrice);
        if (!elActionBar.Data().panelRegisteredForEvents) {
            elActionBar.Data().panelRegisteredForEvents = true;
            $.RegisterForUnhandledEvent('PanoramaComponent_Loadout_EquipSlotChanged', () => _SetupEquipItemBtns(elActionBar, itemId));
        }
        const contentPanel = $.GetContextPanel();
        elActionBar.FindChildInLayoutFile('InspectPlayMvpBtn').SetPanelEvent('onactivate', () => InspectPlayMusic('mvp', contentPanel));
        const category = InventoryAPI.GetLoadoutCategory(itemId);
        if (category == "musickit") {
            InventoryAPI.PlayItemPreviewMusic(itemId, '');
            elActionBar.Data().previewingMusic = true;
            const elMusicBtn = elActionBar.FindChildInLayoutFile('InspectPlayMvpBtn');
            elMusicBtn.SetHasClass('hidden', (InventoryAPI.GetItemRarity(itemId) <= 0));
        }
        const bisItemInLootlist = InspectShared.GetPopupSetting('is_item_in_lootlist');
        elActionBar.FindChildInLayoutFile('InspectWeaponBtn').checked =
            (!elActionBar.FindChildInLayoutFile('InspectCharBtn').checked &&
                !elActionBar.FindChildInLayoutFile('LookatWeaponBtn').checked) ||
                bisItemInLootlist;
        if (bisItemInLootlist) {
            $.DispatchEvent("Activated", elActionBar.FindChildInLayoutFile('InspectWeaponBtn'), "mouse");
        }
    }
    InspectActionBar.Init = Init;
    function _SetUpItemCertificate(elPanel, id) {
        const elCert = elPanel.FindChildInLayoutFile('InspectItemCert');
        if (!elCert || !elCert.IsValid()) {
            return;
        }
        const certData = InventoryAPI.GetItemCertificateInfo(id);
        if (!certData || InspectShared.GetPopupSetting('hide_item_cert')) {
            elCert.visible = false;
            return;
        }
        const aCertData = certData.split("\n");
        let strLine = "";
        for (let i = 0; i < aCertData.length - 1; i++) {
            if (i % 2 == 0) {
                strLine = strLine + "<b>" + aCertData[i] + "</b>" + ": " + aCertData[i + 1] + "<br><br>";
            }
        }
        elCert.visible = true;
        elCert.SetPanelEvent('onmouseover', () => UiToolkitAPI.ShowTextTooltip('InspectItemCert', strLine));
        elCert.SetPanelEvent('onmouseout', () => UiToolkitAPI.HideTextTooltip());
    }
    function _SetUpMarketLink(elPanel, id) {
        const elMarketLinkBtn = elPanel.FindChildInLayoutFile('InspectMarketLink');
        const bMarketLink = InspectShared.GetPopupSetting('show_market_link');
        elMarketLinkBtn.SetHasClass('hidden', !bMarketLink);
        if (!bMarketLink) {
            return;
        }
        elMarketLinkBtn.SetPanelEvent('onmouseover', () => UiToolkitAPI.ShowTextTooltip('InspectMarketLink', '#SFUI_Store_Market_Link'));
        elMarketLinkBtn.SetPanelEvent('onmouseout', () => UiToolkitAPI.HideTextTooltip());
        elMarketLinkBtn.SetPanelEvent('onactivate', () => {
            SteamOverlayAPI.OpenURL(ItemInfo.GetMarketLinkForLootlistItem(id));
        });
    }
    function _SetUpOpenSeasonStatsAction(elPanel, contextPanel, id) {
        if (InspectShared.GetPopupSetting('hide_all_action_items'))
            return;
        const elOpenSeasonPanel = elPanel.FindChildInLayoutFile('OpenSeasonStats');
        if (ItemInfo.ItemDefinitionNameStartsWith(id, 'premier season coin')) {
            const season = InventoryAPI.GetItemAttributeValue(id, 'premier season');
            elOpenSeasonPanel.SetPanelEvent('onactivate', () => {
                UiToolkitAPI.ShowCustomLayoutPopupParameters('id-popup-season-stats', 'file://{resources}/layout/popups/popup_season_stats.xml', 'seasonid=' + season + '&' +
                    'itemid=' + id);
                CloseBtnAction(_GetSettingCallback(contextPanel), elPanel);
            });
            $.DispatchEvent('ContextMenuEvent', '');
            elOpenSeasonPanel.SetHasClass('hidden', false);
        }
    }
    function _SetUpViewHighlightReelAction(elPanel, id) {
        const reelId = InventoryAPI.GetItemAttributeValue(id, '{uint32}keychain slot 0 highlight');
        if (!reelId)
            return;
        const elViewHighlightReelAction = elPanel.FindChildInLayoutFile('ViewHighlightReelAction');
        elViewHighlightReelAction.SetPanelEvent('onactivate', () => {
            UiToolkitAPI.ShowCustomLayoutPopupParameters('popup-videoclip-' + reelId, 'file://{resources}/layout/popups/popup_videoclip.xml', 'reelid=' + reelId + '&' +
                'itemid=' + id);
        });
        elViewHighlightReelAction.SetHasClass('hidden', false);
    }
    function _SetupEquipItemBtns(elPanel, id) {
        const elMoreActionsBtn = elPanel.FindChildInLayoutFile('InspectActionsButton');
        const contextPanel = $.GetContextPanel();
        elMoreActionsBtn.SetPanelEvent('onactivate', () => ShowContextMenu(contextPanel));
        const elSingleActionBtn = elPanel.FindChildInLayoutFile('SingleAction');
        if (InspectShared.GetPopupSetting('is_inside_casket')) {
            elMoreActionsBtn.AddClass('hidden');
            elSingleActionBtn.RemoveClass('hidden');
            elSingleActionBtn.text = !InspectShared.GetPopupSetting('is_selected') ? '#UI_Select' : '#UI_Unselect';
            elSingleActionBtn.SetPanelEvent('onactivate', () => _OnActivateUpdateSelectionForMultiSelect(id, contextPanel));
            return;
        }
        if (InspectShared.GetPopupSetting('hide_all_action_items')) {
            elMoreActionsBtn.AddClass('hidden');
            elSingleActionBtn.AddClass('hidden');
            _TrySetUpSingleActionPreviewBtn(elPanel, id);
            return;
        }
        const isFanToken = ItemInfo.ItemDefinitionNameSubstrMatch(id, 'tournament_pass_');
        const isStickerDisplaySleeve = InventoryAPI.DoesItemMatchDefinitionByName(id, 'sticker_display_case');
        const isSticker = ItemInfo.IsSticker(id);
        const isPatch = ItemInfo.IsPatch(id);
        const isKeychain = ItemInfo.IsKeychain(id);
        const isSpraySealed = ItemInfo.IsSpraySealed(id);
        const isEquipped = InventoryAPI.IsEquipped(id, 't') || InventoryAPI.IsEquipped(id, 'ct') || InventoryAPI.IsEquipped(id, "noteam");
        let bCloseInspectOnSingleAction = (isSticker || isSpraySealed || isFanToken || isPatch || isKeychain || isStickerDisplaySleeve);
        if (ItemInfo.IsEquippalbleButNotAWeapon(id) ||
            bCloseInspectOnSingleAction ||
            isEquipped) {
            elMoreActionsBtn.AddClass('hidden');
            if (!isEquipped) {
                elSingleActionBtn.RemoveClass('hidden');
                _SetUpSingleActionBtn(elPanel, id, bCloseInspectOnSingleAction, contextPanel);
            }
            return;
        }
        else {
            elMoreActionsBtn.RemoveClass('hidden');
            elSingleActionBtn.AddClass('hidden');
        }
    }
    function _SetUpSingleActionBtn(elPanel, id, closeInspect, contextPanel) {
        const validEntries = ItemContextEntries.FilterEntries(id, 'inspect');
        const elSingleActionBtn = elPanel.FindChildInLayoutFile('SingleAction');
        for (let i = 0; i < validEntries.length; i++) {
            const entry = validEntries[i];
            let displayName = '';
            if (entry.name instanceof Function) {
                displayName = entry.name(id);
            }
            else {
                displayName = entry.name;
            }
            elSingleActionBtn.text = '#inv_context_' + displayName;
            elSingleActionBtn.SetPanelEvent('onactivate', () => _OnSingleAction(entry, id, closeInspect, contextPanel));
            elSingleActionBtn.RemoveClass('hidden');
        }
    }
    function _TrySetUpSingleActionPreviewBtn(elPanel, id) {
        const validEntries = ItemContextEntries.FilterEntries(id, 'preview');
        const elSingleActionBtn = elPanel.FindChildInLayoutFile('SingleAction');
        for (let i = 0; i < validEntries.length; i++) {
            const entry = validEntries[i];
            let displayName = '';
            if (entry.name instanceof Function) {
                displayName = entry.name(id);
            }
            else {
                displayName = entry.name;
            }
            const previewActionPrefix = displayName.startsWith('preview_') ? '' : 'preview_';
            const contextPanel = $.GetContextPanel();
            elSingleActionBtn.text = '#inv_context_' + previewActionPrefix + displayName;
            elSingleActionBtn.SetPanelEvent('onactivate', () => {
                const bCloseInspect = (contextPanel.IsValid()) ? false : true;
                _OnSingleAction(entry, id, bCloseInspect, contextPanel);
                if (!bCloseInspect) {
                    $.DispatchEvent('BlurPopupPanel', contextPanel.id, true);
                }
            });
            elSingleActionBtn.RemoveClass('hidden');
        }
    }
    function _OnSingleAction(entry, id, closeInspect, contextPanel) {
        if (closeInspect) {
            CloseBtnAction(_GetSettingCallback(contextPanel), contextPanel);
        }
        entry.OnSelected(id);
    }
    function _SetupAddRemoveToCartButtons(elPanel, id, price) {
        const elAddToCartContainer = elPanel.FindChildInLayoutFile('AddToCartContainer');
        const elPrice = elPanel.FindChildInLayoutFile('MajorItemPrice');
        if (!price) {
            elAddToCartContainer.SetHasClass('hidden', true);
            return;
        }
        elPrice.visible = price > 0;
        elAddToCartContainer.SetHasClass('hidden', false);
        elPanel.SetDialogVariableInt('cart-count', ShoppingCart.cart.getItemQuantity(id));
        elPanel.SetDialogVariableInt('total-items', ShoppingCart.cart.getTotalItems());
        const shopItem = { id: id, name: ItemInfo.GetFormattedName(id), price: price };
        elAddToCartContainer.FindChildInLayoutFile('AddToCart').SetPanelEvent('onactivate', () => {
            ShoppingCart.cart.addItem(shopItem, 1);
            const quantity = ShoppingCart.cart.getItemQuantity(id);
            elPanel.SetDialogVariableInt('cart-count', quantity);
            _ShowHideCartBtn(elPanel, price);
            elPrice.visible = quantity > 0;
        });
        elAddToCartContainer.FindChildInLayoutFile('RemoveFromCart').SetPanelEvent('onactivate', () => {
            ShoppingCart.cart.decrementItem(id);
            const quantity = ShoppingCart.cart.getItemQuantity(id);
            elPanel.SetDialogVariableInt('cart-count', quantity);
            _ShowHideCartBtn(elPanel, price);
            elPrice.visible = price > 0;
        });
    }
    function _SetupCartActionsBtn(elPanel, price, id) {
        if (!price) {
            return;
        }
        const elOpenCartBtn = elPanel.FindChildInLayoutFile('InspectOpenCheckout');
        const cp = $.GetContextPanel();
        function _Callback() {
            CloseBtnAction(_GetSettingCallback(cp), elPanel);
        }
        ;
        const callback = UiToolkitAPI.RegisterJSCallback(_Callback);
        elOpenCartBtn.SetPanelEvent('onactivate', () => {
            if (InspectShared.GetPopupSetting('back_to_checkout', cp)) {
                CloseBtnAction(_GetSettingCallback(cp), elPanel);
                return;
            }
            const popupPanel = UiToolkitAPI.ShowCustomLayoutPopupParameters('id-popup-shopping-cart-checkout', 'file://{resources}/layout/popups/popup_shopping_cart_checkout.xml', '&callback=' + callback);
            popupPanel.Data().eventId = g_ActiveTournamentInfo.eventid;
            popupPanel.Data().isFromInspect = true;
        });
        ShoppingCart.cart.subscribeToUpdates(elOpenCartBtn, 'inspect-sticker', () => {
            elPanel.SetDialogVariableInt('cart-count', ShoppingCart.cart.getItemQuantity(id));
            elPanel.SetDialogVariableInt('total-items', ShoppingCart.cart.getTotalItems());
            elPanel.SetDialogVariableInt('price', ShoppingCart.cart.getItemLinePrice(id));
        });
    }
    function _ShowHideCartBtn(elPanel, price) {
        const elOpenCartBtn = elPanel.FindChildInLayoutFile('InspectOpenCheckout');
        if (!price) {
            elOpenCartBtn.SetHasClass('hidden', true);
            return;
        }
        if (ShoppingCart.cart.getTotalItems() < 1) {
            elOpenCartBtn.SetHasClass('hidden', true);
            return;
        }
        elOpenCartBtn.SetHasClass('hidden', false);
    }
    function _ShowHideFavoriteBtn(cp, elPanel, nPrice) {
        const elBtn = elPanel.FindChildInLayoutFile('id-sticker-bookmark');
        const defIndex = InspectShared.GetPopupSetting('sticker_def_index', cp);
        if (!nPrice || !defIndex) {
            elBtn.SetHasClass('hidden', true);
            return;
        }
        elBtn.checked = GameInterfaceAPI.GetSettingString('cl_major_store_watch_list').split(',').includes(defIndex.toString());
        elBtn.SetPanelEvent('onactivate', () => {
            const aDefIndexes = GameInterfaceAPI.GetSettingString('cl_major_store_watch_list').split(',');
            const idIndex = aDefIndexes.findIndex(id => id === defIndex.toString());
            if (idIndex === -1) {
                aDefIndexes.push(defIndex.toString());
            }
            else {
                aDefIndexes.splice(idIndex, 1);
            }
            GameInterfaceAPI.SetSettingString('cl_major_store_watch_list', aDefIndexes.length > 0 ? aDefIndexes.join(',') : "");
        });
        elBtn.SetPanelEvent('onmouseover', () => {
            UiToolkitAPI.ShowTextTooltip('id-sticker-bookmark', '#major_store_bookmark_tooltip');
        });
        elBtn.SetPanelEvent('onmouseout', () => {
            UiToolkitAPI.HideTextTooltip();
        });
        elBtn.SetHasClass('hidden', false);
    }
    function _OnActivateUpdateSelectionForMultiSelect(idSubjectItem, contextPanel) {
        CloseBtnAction(_GetSettingCallback(contextPanel), contextPanel);
        $.DispatchEvent('UpdateSelectItemForCapabilityPopup', InspectShared.GetPopupSetting('capability', contextPanel), idSubjectItem, !InspectShared.GetPopupSetting('is_selected', contextPanel));
    }
    function _ShowButtonsForWeaponInspect(elPanel, id) {
        const hasAnims = ItemInfo.IsCharacter(id) || ItemInfo.IsWeapon(id) || ItemInfo.IsMelee(id);
        if (InspectShared.GetPopupSetting('hide_char_select')) {
            return;
        }
        if (hasAnims &&
            !ItemInfo.IsEquippalbleButNotAWeapon(id) &&
            !ItemInfo.IsSticker(id) &&
            !ItemInfo.IsSpraySealed(id) &&
            !ItemInfo.ItemDefinitionNameSubstrMatch(id, "tournament_journal_") &&
            !ItemInfo.ItemDefinitionNameSubstrMatch(id, "tournament_pass_")) {
            elPanel.FindChildInLayoutFile('InspectCharBtn').SetHasClass('hidden', !hasAnims);
            elPanel.FindChildInLayoutFile('InspectWeaponBtn').SetHasClass('hidden', !hasAnims);
            elPanel.FindChildInLayoutFile('LookatWeaponBtn').SetHasClass('hidden', !(ItemInfo.IsWeapon(id) || ItemInfo.IsMelee(id)));
            const list = CharacterAnims.GetValidCharacterModels(true).filter((entry) => {
                return (ItemInfo.IsItemCt(id) && (entry.team === 'ct' || entry.team === 'any')) ||
                    (ItemInfo.IsItemT(id) && (entry.team === 't' || entry.team === 'any')) ||
                    ItemInfo.IsItemAnyTeam(id);
            });
            if (list && (list.length > 0) && !elPanel.FindChildInLayoutFile('InspectDropdownCharModels').Data().selectedId)
                _SetDropdown(elPanel, list, id);
        }
        elPanel.FindChildInLayoutFile('ChangeScenery').SetHasClass('hidden', ItemInfo.IsCharacter(id));
    }
    function _ShowButtonsForCharacterInspect(elPanel, id) {
        const elPreviewPanel = InspectModelImage.GetModelPanel();
        if (!ItemInfo.IsCharacter(id))
            return;
        elPanel.FindChildInLayoutFile('id-character-button-container').SetHasClass('hidden', false);
        const inspectCameraPresets = {
            "AspectRatio4x3": [16, 17],
            "AspectRatio16x9": [26, 27],
            "AspectRatio21x9": [28, 29]
        };
        let arrCameraSetToUse = inspectCameraPresets.AspectRatio4x3;
        if ($.GetContextPanel().BAscendantHasClass("AspectRatio16x9") ||
            $.GetContextPanel().BAscendantHasClass("AspectRatio16x10")) {
            arrCameraSetToUse = inspectCameraPresets.AspectRatio16x9;
        }
        else if ($.GetContextPanel().BAscendantHasClass("AspectRatio21x9")) {
            arrCameraSetToUse = inspectCameraPresets.AspectRatio21x9;
        }
        const characterToolbarButtonSettings = {
            charItemId: id,
            cameraPresetUnzoomed: arrCameraSetToUse[0],
            cameraPresetZoomed: arrCameraSetToUse[1]
        };
        const elCharacterButtons = elPanel.FindChildInLayoutFile('id-character-buttons');
        CharacterButtons.InitCharacterButtons(elCharacterButtons, elPreviewPanel, characterToolbarButtonSettings);
    }
    function _SetDropdown(elPanel, validEntiresList, id) {
        const currentMainMenuVanitySettings = ItemInfo.GetOrUpdateVanityCharacterSettings(ItemInfo.IsItemAnyTeam(id) ? null
            : LoadoutAPI.GetItemID(ItemInfo.IsItemCt(id) ? 'ct' : 't', 'customplayer'));
        const elDropdown = elPanel.FindChildInLayoutFile('InspectDropdownCharModels');
        for (let entry of validEntiresList) {
            const rarityColor = InventoryAPI.GetItemRarityColor(entry.itemId);
            const newEntry = $.CreatePanel('Label', elDropdown, entry.itemId, {
                'class': 'DropDownMenu',
                'html': 'true',
                'text': "<font color='" + rarityColor + "'>•</font> " + entry.label,
                'data-team': (entry.team === 'any') ? ((ItemInfo.IsItemT(id) || ItemInfo.IsItemAnyTeam(id)) ? 't' : 'ct') : entry.team
            });
            elDropdown.AddOption(newEntry);
        }
        const itemId = InspectShared.GetPopupSetting('item_id');
        const contextPanel = $.GetContextPanel();
        elDropdown.SetPanelEvent('oninputsubmit', () => InspectActionBar.OnUpdateCharModel(elDropdown, itemId, contextPanel));
        elDropdown.SetSelected(currentMainMenuVanitySettings.charItemId);
    }
    function OnUpdateCharModel(elDropdown, weaponItemId, contextPanel) {
        const characterItemId = elDropdown.GetSelected().id;
        elDropdown.Data().selectedId = elDropdown.GetSelected().id;
        InspectModelImage.SetCharScene(characterItemId, weaponItemId, contextPanel);
    }
    InspectActionBar.OnUpdateCharModel = OnUpdateCharModel;
    function NavigateModelPanel(type, bEndWeaponLookat = true) {
        InspectModelImage.ShowHideItemPanel((type !== 'InspectModelChar'));
        InspectModelImage.ShowHideCharPanel((type === 'InspectModelChar'));
        $.GetContextPanel().FindChildTraverse('InspectCharModelsControls').SetHasClass('hidden', type !== 'InspectModelChar');
        if (bEndWeaponLookat) {
            InspectModelImage.EndWeaponLookat();
        }
        const elDesc = $.GetContextPanel().GetParent().FindChildInLayoutFile('InspectItemDesc');
        if (elDesc && elDesc.IsValid()) {
            elDesc.SetHasClass('hidden', false);
        }
    }
    InspectActionBar.NavigateModelPanel = NavigateModelPanel;
    function InspectPlayMusic(type, contentPanel) {
        const elActionBar = contentPanel.FindChildInLayoutFile('PopUpInspectActionBar');
        if (!elActionBar.Data().previewingMusic)
            return;
        const itemId = InspectShared.GetPopupSetting('item_id', contentPanel);
        if (type === 'mvp') {
            if (elActionBar.Data().schfnMusicMvpPreviewEnd)
                return;
            InventoryAPI.StopItemPreviewMusic();
            InventoryAPI.PlayItemPreviewMusic(itemId, 'MVPPreview');
            elActionBar.Data().schfnMusicMvpPreviewEnd = $.Schedule(6.8, () => InspectActionBar.InspectPlayMusic('schfn', contentPanel));
        }
        else if (type === 'schfn') {
            elActionBar.Data().schfnMusicMvpPreviewEnd = null;
            InventoryAPI.StopItemPreviewMusic();
            InventoryAPI.PlayItemPreviewMusic(itemId, '');
        }
    }
    InspectActionBar.InspectPlayMusic = InspectPlayMusic;
    function ShowContextMenu(contextPanel) {
        const elBtn = contextPanel.FindChildTraverse('InspectActionsButton');
        const id = InspectShared.GetPopupSetting('item_id', contextPanel);
        const contextMenuPanel = UiToolkitAPI.ShowCustomLayoutContextMenuParametersDismissEvent(elBtn.id, '', 'file://{resources}/layout/context_menus/context_menu_inventory_item.xml', 'itemid=' + id + '&populatefiltertext=inspect', () => $.DispatchEvent("CSGOPlaySoundEffect", "weapon_selectReplace", "MOUSE"));
        contextMenuPanel.AddClass("ContextMenu_NoArrow");
    }
    InspectActionBar.ShowContextMenu = ShowContextMenu;
    function _SetCloseBtnAction(elPanel, contextPanel) {
        const elBtn = elPanel.FindChildInLayoutFile('InspectCloseBtn');
        elBtn.SetPanelEvent('onactivate', () => CloseBtnAction(_GetSettingCallback(contextPanel), elPanel));
    }
    function _GetSettingCallback(contextPanel) {
        let callbackFromPopup = InspectShared.GetPopupSetting('callback_handle', contextPanel);
        return !callbackFromPopup ? -1 : callbackFromPopup;
    }
    function UpdateScenery() {
        UiToolkitAPI.ShowCustomLayoutContextMenuParametersDismissEvent('id-inspect-contextmenu-maps', '', 'file://{resources}/layout/context_menus/context_menu_mainmenu_vanity.xml', 'type=maps' +
            '&' + 'inspect-map=true', () => $.DispatchEvent('ContextMenuEvent', ''));
    }
    InspectActionBar.UpdateScenery = UpdateScenery;
    function LookatWeapon() {
        const bEndWeaponLookat = false;
        NavigateModelPanel('InspectModel', bEndWeaponLookat);
        const elDesc = $.GetContextPanel().GetParent().FindChildInLayoutFile('InspectItemDesc');
        if (elDesc && elDesc.IsValid()) {
            elDesc.SetHasClass('hidden', true);
        }
        InspectModelImage.StartWeaponLookat();
    }
    InspectActionBar.LookatWeapon = LookatWeapon;
    function CloseBtnAction(callbackHandle = -1, elActionBar) {
        $.DispatchEvent("CSGOPlaySoundEffect", "inventory_inspect_close", "MOUSE");
        $.DispatchEvent('UIPopupButtonClicked', '');
        UiToolkitAPI.HideTextTooltip();
        if (callbackHandle != -1) {
            UiToolkitAPI.InvokeJSCallback(callbackHandle);
        }
        if (elActionBar.Data().previewingMusic) {
            InventoryAPI.StopItemPreviewMusic();
            elActionBar.Data().previewingMusic = false;
            if (elActionBar.Data().schfnMusicMvpPreviewEnd) {
                $.CancelScheduled(elActionBar.Data().schfnMusicMvpPreviewEnd);
                elActionBar.Data().schfnMusicMvpPreviewEnd = null;
            }
        }
    }
    InspectActionBar.CloseBtnAction = CloseBtnAction;
})(InspectActionBar || (InspectActionBar = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9wdXBfaW5zcGVjdF9hY3Rpb24tYmFyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vY29udGVudC9jc2dvL3Bhbm9yYW1hL3NjcmlwdHMvcG9wdXBzL3BvcHVwX2luc3BlY3RfYWN0aW9uLWJhci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEscUNBQXFDO0FBQ3JDLDBEQUEwRDtBQUMxRCxzQ0FBc0M7QUFDdEMsK0NBQStDO0FBQy9DLG1EQUFtRDtBQUVuRCxJQUFVLGdCQUFnQixDQWtzQnpCO0FBbHNCRCxXQUFVLGdCQUFnQjtJQUV6QixTQUFnQixJQUFJO1FBRW5CLE1BQU0sV0FBVyxHQUFHLENBQUMsQ0FBQyxlQUFlLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBRSx1QkFBdUIsQ0FBRSxDQUFDO1FBRXpGLElBQUssQ0FBQyxhQUFhLENBQUMsZUFBZSxDQUFFLGNBQWMsQ0FBRSxFQUNyRDtZQUNDLFdBQVcsQ0FBQyxRQUFRLENBQUUsUUFBUSxDQUFFLENBQUM7WUFDakMsT0FBTztTQUNQO1FBRUQsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDLHVCQUF1QixHQUFHLElBQXFCLENBQUM7UUFDbkUsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDLGVBQWUsR0FBRyxLQUFLLENBQUM7UUFDM0MsV0FBVyxDQUFDLFdBQVcsQ0FBRSxRQUFRLENBQUUsQ0FBQztRQUNwQyxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUMsd0JBQXdCLEdBQUcsS0FBSyxDQUFDO1FBRXBELE1BQU0sTUFBTSxHQUFHLGFBQWEsQ0FBQyxlQUFlLENBQUUsU0FBUyxDQUFZLENBQUM7UUFFcEUscUJBQXFCLENBQUUsV0FBVyxFQUFFLE1BQU0sQ0FBRSxDQUFDO1FBQzdDLG1CQUFtQixDQUFFLFdBQVcsRUFBRSxNQUFNLENBQUUsQ0FBQztRQUMzQyw0QkFBNEIsQ0FBRSxXQUFXLEVBQUUsTUFBTSxDQUFFLENBQUM7UUFDcEQsK0JBQStCLENBQUUsV0FBVyxF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