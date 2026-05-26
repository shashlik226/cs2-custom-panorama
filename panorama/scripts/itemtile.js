"use strict";
/// <reference path="csgo.d.ts" />
/// <reference path="common/iteminfo.ts" />
/// <reference path="popups/popup_select_item_for_capability.ts" />
/// <reference path="common/formattext.ts" />
var ItemTile;
(function (ItemTile) {
    function _OnTileUpdated(elTeamTile) {
        let id = elTeamTile.GetAttributeString('itemid', '0');
        if (id === '0')
            return;
        let idForDisplay = id;
        if (elTeamTile.GetAttributeString('filter_category', '') === 'inv_graphic_art') {
            idForDisplay = ItemInfo.GetFauxReplacementItemID(id, 'graffiti');
        }
        _SetItemName(idForDisplay);
        _SetItemRarity(id);
        _SetEquippedState(id);
        _SetStickers(id);
        _SetRecentLabel(id);
        _TintSprayImage(id);
        _DisableTile(id);
        _SetBackground(id);
        _SetMultiSelect(id);
        _SetRentalTime(id);
        _SetIsRentable(id);
        _SetOriginalOwner(id);
        let loadImage = $.GetContextPanel().GetAttributeString('loadimage', '');
        if (loadImage) {
            _SetImage(id);
        }
    }
    ;
    function _SetItemName(id) {
        let fmtName = ItemInfo.GetFormattedName(id);
        fmtName.SetOnLabel($('#JsItemName'));
    }
    ;
    function _SetBackground(id) {
        let elTeamTile = $.GetContextPanel().FindChildInLayoutFile('ItemTileTeam');
        let subSlot = InventoryAPI.GetDefaultSlot(id);
        if (subSlot == 'customplayer') {
            elTeamTile.visible = true;
            let isCT = ItemInfo.IsItemCt(id);
            if (isCT) {
                elTeamTile.SetImage("file://{images}/icons/ui/ct_logo_1c.svg");
                elTeamTile.style.washColor = '#B5D4EE';
            }
            else {
                elTeamTile.SetImage("file://{images}/icons/ui/t_logo_1c.svg");
                elTeamTile.style.washColor = '#EAD18A';
            }
        }
        else {
            elTeamTile.visible = false;
        }
    }
    function _SetMultiSelect(id) {
        let ocapabilityInfo = _GetPopUpCapability();
        if (ocapabilityInfo) {
            let bSelectedInMultiSelect = (SelectItemForCapability.oCapabilityInfo.bIsMultiSelect &&
                SelectItemForCapability.oCapabilityInfo.multiselectItemIds &&
                SelectItemForCapability.oCapabilityInfo.multiselectItemIds.hasOwnProperty(id));
            $.GetContextPanel().SetHasClass('capability_multistatus_selected', bSelectedInMultiSelect);
        }
    }
    ;
    function _SetImage(id) {
        $.GetContextPanel().FindChildInLayoutFile('ItemImage').itemid = id;
    }
    ;
    function _SetItemRarity(id) {
        let color = InventoryAPI.GetItemRarityColor(id);
        if (!color)
            return;
        $.GetContextPanel().FindChildInLayoutFile('JsRarity').style.backgroundColor = color;
    }
    ;
    function _SetEquippedState(id) {
        let elNoteamDot = $.GetContextPanel().FindChildInLayoutFile('ItemEquipped-noteam');
        let elCtDot = $.GetContextPanel().FindChildInLayoutFile('ItemEquipped-ct');
        let elTDot = $.GetContextPanel().FindChildInLayoutFile('ItemEquipped-t');
        let elFavoriteIconNoteam = $.GetContextPanel().FindChildInLayoutFile('FavoriteIcon-noteam');
        let elFavoriteIconCt = $.GetContextPanel().FindChildInLayoutFile('FavoriteIcon-ct');
        let elFavoriteIconT = $.GetContextPanel().FindChildInLayoutFile('FavoriteIcon-t');
        elTDot.AddClass('hidden');
        elCtDot.AddClass('hidden');
        elNoteamDot.AddClass('hidden');
        elTDot.RemoveClass('item-tile__equipped__radiodot--filled');
        elCtDot.RemoveClass('item-tile__equipped__radiodot--filled');
        elNoteamDot.RemoveClass('item-tile__equipped__radiodot--filled');
        elFavoriteIconNoteam.SetHasClass('hidden', !InventoryAPI.ItemIsInFavorites('noteam', id));
        elFavoriteIconCt.SetHasClass('hidden', !InventoryAPI.ItemIsInFavorites('ct', id));
        elFavoriteIconT.SetHasClass('hidden', !InventoryAPI.ItemIsInFavorites('t', id));
        for (let team of ['t', 'ct', 'noteam']) {
            if (_ItemIsInShuffle(id, team)) {
                _SetEquipIcon(true, team);
            }
            else if (InventoryAPI.IsEquipped(id, team)) {
                _SetEquipIcon(false, team);
            }
        }
    }
    ;
    function _ItemIsInShuffle(id, team) {
        let slot = InventoryAPI.GetRawDefinitionKey(id, 'flexible_loadout_group');
        if (['secondary0', 'secondary', 'smg', 'rifle'].includes(slot)) {
            let itemDefIndex = InventoryAPI.GetItemDefinitionIndex(id);
            slot = LoadoutAPI.GetSlotEquippedWithDefIndex(team, itemDefIndex);
        }
        return LoadoutAPI.IsShuffleEnabled(team, slot) && InventoryAPI.ItemIsInFavorites(team, id);
    }
    ;
    function _SetEquipIcon(isShuffle, team) {
        let elCtDot = $.GetContextPanel().FindChildInLayoutFile('ItemEquipped-' + team);
        elCtDot.RemoveClass('hidden');
        elCtDot.AddClass('item-tile__equipped__radiodot--filled');
        elCtDot.SetHasClass('shuffle', isShuffle);
    }
    ;
    function _SetStickers(id) {
        let elParentStickers = $.GetContextPanel().FindChildInLayoutFile('StickersOnWeapon');
        elParentStickers.RemoveAndDeleteChildren();
        let elParentKeychains = $.GetContextPanel().FindChildInLayoutFile('KeychainsOnWeapon');
        elParentKeychains.RemoveAndDeleteChildren();
        let listStickers = ItemInfo.GetitemStickerList(id);
        for (let entry of listStickers) {
            $.CreatePanel('Image', elParentStickers, 'ItemImage' + entry.image, {
                src: 'file://{images}' + entry.image + '.png',
                scaling: 'stretch-to-fit-preserve-aspect',
                class: 'item-tile__stickers__image'
            });
        }
        elParentStickers.SetHasClass('hidden', listStickers.length <= 0 || listStickers === undefined);
        let listKeychains = ItemInfo.GetitemKeychainList(id);
        for (let entry of listKeychains) {
            $.CreatePanel('Image', elParentKeychains, 'ItemImage' + entry.image, {
                src: 'file://{images}' + entry.image + '.png',
                scaling: 'stretch-to-fit-preserve-aspect',
                class: 'item-tile__stickers__image'
            });
        }
        elParentKeychains.SetHasClass('hidden', listKeychains.length <= 0 || listKeychains === undefined);
    }
    ;
    function _SetRecentLabel(id) {
        let elLabel = $.GetContextPanel().FindChildInLayoutFile('JsRecent');
        let unProtectedEscrowValue = InventoryAPI.GetItemAttributeValue(id, '{uint32}trade protected escrow date');
        if ((unProtectedEscrowValue !== undefined) && (unProtectedEscrowValue == 0)) {
            elLabel.RemoveClass('hidden');
            elLabel.text = $.Localize('#inv_session_prop_marketlisting');
            return;
        }
        let isRecentValue = InventoryAPI.GetItemSessionPropertyValue(id, 'recent');
        let isUpdatedValue = InventoryAPI.GetItemSessionPropertyValue(id, 'updated');
        if (isUpdatedValue === '1' || isRecentValue === '1') {
            let locString = 'recent';
            if (isRecentValue === '1') {
                let strItemPickupMethod = InventoryAPI.GetItemSessionPropertyValue(id, 'item_pickup_method');
                if (strItemPickupMethod && ['xpshopredeem', 'quest_reward'].includes(strItemPickupMethod)) {
                    locString = strItemPickupMethod;
                }
            }
            else {
                locString = 'updated';
            }
            elLabel.RemoveClass('hidden');
            elLabel.text = $.Localize('#inv_session_prop_' + locString);
            return;
        }
        elLabel.AddClass('hidden');
    }
    ;
    function _TintSprayImage(id) {
        let elImage = $.GetContextPanel().FindChildInLayoutFile('ItemImage');
        TintSprayIcon.CheckIsSprayAndTint(id, elImage);
    }
    ;
    function _DisableTile(id) {
        let capabilityInfo = _GetPopUpCapability();
        if (capabilityInfo && capabilityInfo.capability === 'can_sticker' && !ItemInfo.IsSticker(id)) {
            $.GetContextPanel().enabled = (InventoryAPI.GetItemStickerSlotCount(id) > InventoryAPI.GetItemStickerCount(id));
        }
        else if (capabilityInfo && capabilityInfo.capability === 'can_patch' && !ItemInfo.IsPatch(id)) {
            $.GetContextPanel().enabled = (InventoryAPI.GetItemStickerSlotCount(id) > InventoryAPI.GetItemStickerCount(id));
        }
        else if (capabilityInfo && capabilityInfo.capability === 'can_keychain' && !ItemInfo.IsKeychain(id)) {
            $.GetContextPanel().enabled = (InventoryAPI.GetItemKeychainSlotCount(id) > InventoryAPI.GetItemKeychainCount(id));
        }
    }
    ;
    function _SetRentalTime(id) {
        let elLabel = $.GetContextPanel().FindChildInLayoutFile('JsItemRental');
        let bHide = !InventoryAPI.IsRental(id);
        if (bHide) {
            elLabel.AddClass('hidden');
            return;
        }
        const expirationDate = InventoryAPI.GetExpirationDate(id);
        if (expirationDate <= 0) {
            elLabel.AddClass('hidden');
            return;
        }
        let oLocData = FormatText.FormatRentalTime(expirationDate);
        elLabel.SetHasClass('item-expired', oLocData.isExpired);
        elLabel.SetDialogVariable('time-remaining', oLocData.time);
        elLabel.text = $.Localize(oLocData.locString, elLabel);
        elLabel.RemoveClass('hidden');
    }
    function _SetIsRentable(id) {
        let elLabel = $.GetContextPanel().FindChildInLayoutFile('JsCanRentItem');
        if (!InventoryAPI.CanOpenForRental(id)) {
            elLabel.AddClass('hidden');
            return;
        }
        elLabel.text = $.Localize('#item-can-rent');
        elLabel.RemoveClass('hidden');
    }
    ItemTile._SetIsRentable = _SetIsRentable;
    function _SetOriginalOwner(id) {
        const elImage = $.GetContextPanel().FindChildInLayoutFile('JsOriginalOwner');
        elImage.SetHasClass('hidden', !(InventoryAPI.GetItemAttributeValue(id, '{uint32}purchaser account id') != undefined));
    }
    function OnActivate() {
        HideTooltip();
        let id = $.GetContextPanel().GetAttributeString('itemid', '0');
        if ($.GetContextPanel().FindAncestor("id-popup-select-item-list") != null) {
            $.DispatchEvent("OnItemTileActivated", $.GetContextPanel(), id);
            return;
        }
        if ($.GetContextPanel().FindAncestor("id-pet-sticker-item-list") != null) {
            $.DispatchEvent("OnItemTileActivated", $.GetContextPanel(), id);
            return;
        }
        if ($.GetContextPanel().FindAncestor("Crafting-Items") != null) {
            InventoryAPI.AddCraftIngredient(id);
            return;
        }
        if ($.GetContextPanel().FindAncestor("Crafting-Ingredients") != null) {
            InventoryAPI.RemoveCraftIngredient(id);
            return;
        }
        let filterValue = $.GetContextPanel().GetAttributeString('context_menu_filter', '');
        let filterForContextMenuEntries = filterValue ? '&populatefiltertext=' + filterValue : '';
        let contextmenuparam = '';
        if ($.GetContextPanel().GetAttributeString('filter_category', '') === 'inv_graphic_art')
            contextmenuparam = '&contextmenuparam=graffiti';
        let contextMenuPanel = UiToolkitAPI.ShowCustomLayoutContextMenuParametersDismissEvent('', '', 'file://{resources}/layout/context_menus/context_menu_inventory_item.xml', 'itemid=' + id + filterForContextMenuEntries + contextmenuparam, () => { });
        contextMenuPanel.AddClass("ContextMenu_NoArrow");
        contextMenuPanel.AddClass("ContextMenuCursorTopLeft");
    }
    ItemTile.OnActivate = OnActivate;
    ;
    let updateItemListCallback;
    function OnActivateInspectButtonFromTile() {
        let id = $.GetContextPanel().GetAttributeString('itemid', '0');
        if ($.GetContextPanel().FindAncestor("Crafting-Items") != null || $.GetContextPanel().FindAncestor("Crafting-Ingredients") != null) {
            $.DispatchEvent("InventoryItemPreview", id, '');
            return;
        }
        let oCapabilityInfo = _GetPopUpCapability();
        if (oCapabilityInfo !== null && oCapabilityInfo.popupVisible) {
            if (updateItemListCallback) {
                UiToolkitAPI.UnregisterJSCallback(updateItemListCallback);
            }
            updateItemListCallback = UiToolkitAPI.RegisterJSCallback(SelectItemForCapability.UpdateSort);
            const elPanel = UiToolkitAPI.ShowCustomLayoutPopup('', 'file://{resources}/layout/popups/popup_inventory_inspect.xml');
            let oSettings = {
                item_id: id,
                inspect_only: true,
                is_inside_casket: oCapabilityInfo.initialItemId ? true : false,
                capability: oCapabilityInfo.capability,
                hide_all_action_items: true,
                is_selected: $.GetContextPanel().BHasClass('capability_multistatus_selected'),
                callback_handle: updateItemListCallback
            };
            elPanel.Data().oSettings = oSettings;
        }
    }
    ItemTile.OnActivateInspectButtonFromTile = OnActivateInspectButtonFromTile;
    function _GetPopUpCapability() {
        if (typeof SelectItemForCapability === "object") {
            if (SelectItemForCapability.oCapabilityInfo.popupVisible) {
                return SelectItemForCapability.oCapabilityInfo;
            }
        }
        return null;
    }
    ;
    let jsTooltipDelayHandle = null;
    function ShowVideoClip() {
        const id = $.GetContextPanel().GetAttributeString('itemid', '0');
        const reelId = InventoryAPI.GetItemAttributeValue(id, '{uint32}keychain slot 0 highlight');
        if (reelId) {
            const reelJson = InventoryAPI.BuildHighlightReelSchemaJSON(reelId);
            const reelSchemaDef = JSON.parse(reelJson);
            const videoPlayerContainer = $.GetContextPanel().FindChildTraverse('VideoClipMovieContainer');
            const videoPlayer = $.GetContextPanel().FindChildTraverse('VideoClipMovie');
            if (videoPlayerContainer && videoPlayer) {
                videoPlayerContainer.AddClass('play');
                videoPlayer.AddClass('play');
                videoPlayer.SetMovie(reelSchemaDef["url_480p"]);
                videoPlayer.Play();
            }
        }
    }
    function HideVideoClip() {
        let id = $.GetContextPanel().GetAttributeString('itemid', '0');
        if (InventoryAPI.GetItemAttributeValue(id, '{uint32}keychain slot 0 highlight')) {
            const videoPlayerContainer = $.GetContextPanel().FindChildTraverse('VideoClipMovieContainer');
            const videoPlayer = $.GetContextPanel().FindChildTraverse('VideoClipMovie');
            if (videoPlayerContainer && videoPlayer) {
                videoPlayerContainer.RemoveClass('play');
                videoPlayer.RemoveClass('play');
                videoPlayer.Stop();
            }
        }
    }
    function ShowTooltip() {
        jsTooltipDelayHandle = $.Schedule(.4, ShowToolTipOnDelay);
    }
    ItemTile.ShowTooltip = ShowTooltip;
    function ShowToolTipOnDelay() {
        let id = $.GetContextPanel().GetAttributeString('itemid', '0');
        jsTooltipDelayHandle = null;
        if (!InventoryAPI.IsItemInfoValid(id)) {
            return;
        }
        UiToolkitAPI.ShowCustomLayoutParametersTooltip('ItemImage', 'JsItemTooltip', 'file://{resources}/layout/tooltips/tooltip_inventory_item.xml', 'itemid=' + id);
        ShowVideoClip();
    }
    ;
    function HideTooltip() {
        UiToolkitAPI.HideCustomLayoutTooltip('JsItemTooltip');
        if (jsTooltipDelayHandle) {
            $.CancelScheduled(jsTooltipDelayHandle);
            jsTooltipDelayHandle = null;
        }
        HideVideoClip();
    }
    ItemTile.HideTooltip = HideTooltip;
    ;
    {
        $.RegisterEventHandler('CSGOInventoryItemLoaded', $.GetContextPanel(), _OnTileUpdated);
        $.RegisterEventHandler('UpdateItemTile', $.GetContextPanel(), _OnTileUpdated);
        $.RegisterEventHandler('CSGOInventoryHideTooltip', $.GetContextPanel(), HideTooltip);
    }
})(ItemTile || (ItemTile = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaXRlbXRpbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9jb250ZW50L2NzZ28vcGFub3JhbWEvc2NyaXB0cy9pdGVtdGlsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsa0NBQWtDO0FBQ2xDLDJDQUEyQztBQUMzQyxtRUFBbUU7QUFDbkUsNkNBQTZDO0FBRTdDLElBQVUsUUFBUSxDQXlmakI7QUF6ZkQsV0FBVSxRQUFRO0lBRWpCLFNBQVMsY0FBYyxDQUFFLFVBQWtCO1FBRTFDLElBQUksRUFBRSxHQUFHLFVBQVUsQ0FBQyxrQkFBa0IsQ0FBRSxRQUFRLEVBQUUsR0FBRyxDQUFFLENBQUM7UUFFeEQsSUFBSyxFQUFFLEtBQUssR0FBRztZQUNkLE9BQU87UUFFUixJQUFJLFlBQVksR0FBRyxFQUFFLENBQUM7UUFDdEIsSUFBSyxVQUFVLENBQUMsa0JBQWtCLENBQUUsaUJBQWlCLEVBQUUsRUFBRSxDQUFFLEtBQUssaUJBQWlCLEVBQ2pGO1lBQ0MsWUFBWSxHQUFHLFFBQVEsQ0FBQyx3QkFBd0IsQ0FBRSxFQUFFLEVBQUUsVUFBVSxDQUFFLENBQUM7U0FDbkU7UUFFRCxZQUFZLENBQUUsWUFBWSxDQUFFLENBQUM7UUFDN0IsY0FBYyxDQUFFLEVBQUUsQ0FBRSxDQUFDO1FBQ3JCLGlCQUFpQixDQUFFLEVBQUUsQ0FBRSxDQUFDO1FBQ3hCLFlBQVksQ0FBRSxFQUFFLENBQUUsQ0FBQztRQUNuQixlQUFlLENBQUUsRUFBRSxDQUFFLENBQUM7UUFDdEIsZUFBZSxDQUFFLEVBQUUsQ0FBRSxDQUFDO1FBQ3RCLFlBQVksQ0FBRSxFQUFFLENBQUUsQ0FBQztRQUNuQixjQUFjLENBQUUsRUFBRSxDQUFFLENBQUM7UUFDckIsZUFBZSxDQUFFLEVBQUUsQ0FBRSxDQUFDO1FBQ3RCLGNBQWMsQ0FBRSxFQUFFLENBQUUsQ0FBQztRQUNyQixjQUFjLENBQUUsRUFBRSxDQUFDLENBQUM7UUFDcEIsaUJBQWlCLENBQUUsRUFBRSxD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