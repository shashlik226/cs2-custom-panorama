"use strict";
/// <reference path="../csgo.d.ts" />
/// <reference path="../common/shopping_cart.ts" />
/// <reference path="../generated/items_event_current_generated_store.d.ts" />
/// <reference path="../generated/items_event_current_generated_store.ts" />
/// <reference path="../common/formattext.ts" />
/// <reference path="../common/hold_button.ts" />
/// <reference path="../common/add_major_tokens_anim.ts" />
/// <reference path="../popups/popup_major_store.ts" />
/// <reference path="../popups/popup_acknowledge_item.ts" />
var PopUpShoppingCartCheckout;
(function (PopUpShoppingCartCheckout) {
    const m_maxInventoryCount = 900;
    function getCart(cp) {
        if (!cp)
            cp = $.GetContextPanel();
        let cart = ShoppingCart.cart;
        while (cp) {
            if (cp.Data().hasOwnProperty('cart') && cp.Data().cart) {
                cart = cp.Data().cart;
                break;
            }
            cp = cp.GetParent();
        }
        return cart;
    }
    function OnReadyForDisplay() {
        if (!MyPersonaAPI.IsConnectedToGC()) {
            ClosePopup();
            return;
        }
        const cp = $.GetContextPanel();
        $.RegisterForUnhandledEvent('PanoramaComponent_Inventory_ItemCustomizationNotification', (...args) => { _ItemCustomizationNotification(...args, cp); });
        $.RegisterForUnhandledEvent('PanoramaComponent_Store_PurchaseCompleted', (...args) => { _OnPurchaseCompletion(...args, cp); });
        $.RegisterForUnhandledEvent('PanoramaComponent_MyPersona_UpdateConnectionToGC', Init);
        cp.FindChildInLayoutFile('id-cart-close').SetPanelEvent('onactivate', ClosePopup);
        cp.FindChildInLayoutFile('id-cart-balance').SetDialogVariable('local-price', StoreAPI.GetStoreItemTokensBundlePrice('' + g_ActiveTournamentInfo.itemid_charge, 100, ''));
        cp.FindChildInLayoutFile('id-cart-balance').SetPanelEvent('onmouseover', () => {
            UiToolkitAPI.ShowTitleTextTooltip('id-cart-balance', '#CSGO_TournamentPass_' + g_ActiveTournamentInfo.location + '_credits', '#major_store_balance_tooltip');
        });
        cp.FindChildInLayoutFile('id-cart-balance').SetPanelEvent('onmouseout', () => {
            UiToolkitAPI.HideTitleTextTooltip();
        });
        AddMajorTokensAnim.SetTransitionEndEvent(cp.FindChildInLayoutFile('id-cart-add-tokens'));
    }
    function OnUnreadyForDisplay() {
    }
    function Init() {
        if (!MyPersonaAPI.IsConnectedToGC()) {
            ClosePopup();
            return;
        }
        const cp = $.GetContextPanel();
        const strOneOffCartId = cp.GetAttributeString('cartid', '');
        if (strOneOffCartId) {
            let cart = ShoppingCart.findOrCreateTempCart(strOneOffCartId, false);
            if (cart) {
                cp.Data().cart = cart;
                ShoppingCart.releaseTempCart(strOneOffCartId);
            }
        }
        cp.SetHasClass('shopping-oneoff-cart', getCart(cp) !== ShoppingCart.cart);
        _SetRedeemableBalance(cp);
        getCart(cp).subscribeToUpdates(cp, 'purchase-btn', () => {
            _SetupButtonsAndWarnings(cp);
        });
        _SetUpEmptyState(cp);
        _MakeCartTiles(cp);
        getCart(cp).subscribeToUpdates(cp, 'total-price', () => {
            cp.SetDialogVariableInt('total-price', getCart(cp).getTotalPrice());
        });
        getCart(cp).subscribeToUpdates(cp, 'total-count', () => {
            cp.SetDialogVariableInt('total-count', getCart(cp).getTotalItems());
        });
        cp.FindChildInLayoutFile('id-checkout-clear-all').SetPanelEvent('onactivate', () => {
            getCart(cp).clearCart();
            _SetUpEmptyState(cp);
            _MakeCartTiles(cp);
        });
        if (StoreAPI.GetSecondsUntilPendingPriceUpdate(g_ActiveTournamentInfo.itemid_dynamic_stickers) > 0) {
            PopupMajorStore.PriceRefreshTimerUpdate(cp);
        }
    }
    PopUpShoppingCartCheckout.Init = Init;
    function _SetRedeemableBalance(cp) {
        const idxLookup = InventoryAPI.GetCacheTypeElementIndexByKey('SeasonalOperations', g_ActiveTournamentInfo.credits_id);
        let nRedeemableBalance = 0;
        if (g_ActiveTournamentInfo.credits_id == InventoryAPI.GetCacheTypeElementFieldByIndex('SeasonalOperations', idxLookup, 'season_value')) {
            nRedeemableBalance = InventoryAPI.GetCacheTypeElementFieldByIndex('SeasonalOperations', idxLookup, 'redeemable_balance');
            nRedeemableBalance = (nRedeemableBalance === null || nRedeemableBalance === undefined) ? 0 : nRedeemableBalance;
        }
        cp.SetDialogVariableInt('balance', nRedeemableBalance);
        cp.Data().redeemableBalance = nRedeemableBalance;
    }
    function _SetupButtonsAndWarnings(cp) {
        const isInventoryFull = InventoryAPI.GetInventoryCount() >= (m_maxInventoryCount - getCart(cp).getTotalItems());
        cp.FindChildInLayoutFile('id-cart-warning').visible = isInventoryFull;
        _AcknowledgeNewTokens(cp);
        $.Schedule(.4, () => {
            let itemId = '';
            let numInactiveTokens = 0;
            if (!cp || !cp.IsValid()) {
                return;
            }
            InventoryAPI.SetInventorySortAndFilters('inv_sort_age', false, 'tool_type:seasontiers,has_attribute:season access:==:' + g_ActiveTournamentInfo.credits_id, '', '');
            if (InventoryAPI.GetInventoryCount() > 0) {
                itemId = InventoryAPI.GetInventoryItemIDByIndex(0);
                numInactiveTokens = Number(InventoryAPI.GetItemAttributeValue(itemId, '{uint32}upgrade level'));
            }
            cp.Data().activatedCredits = numInactiveTokens;
            let nPurchaseTokens = getCart(cp).getTotalPrice() - (cp.Data().redeemableBalance + numInactiveTokens);
            const nActualNumberOfPurchaseTokensNeeded = nPurchaseTokens;
            nPurchaseTokens = nPurchaseTokens > 0 ? Math.max(nPurchaseTokens, 100) : 0;
            const nTokensNeeded = getCart(cp).getTotalPrice() - cp.Data().redeemableBalance;
            cp.SetDialogVariableInt('tokens-needed', nTokensNeeded);
            cp.SetDialogVariableInt('inactive-tokens', numInactiveTokens);
            cp.SetDialogVariableInt('purchase-tokens', nPurchaseTokens);
            cp.FindChildInLayoutFile('id-cart-not-enough-tokens').SetHasClass('show', nTokensNeeded >= 0 && !isInventoryFull && getCart(cp).getTotalPrice() > 0);
            let oSettings = {
                cp: cp,
                nInactiveTokens: numInactiveTokens,
                nPurchaseTokens: nPurchaseTokens,
                nActualNumberOfPurchaseTokensNeeded: nActualNumberOfPurchaseTokensNeeded,
                nTokensNeeded: nTokensNeeded,
                isInventoryFull: isInventoryFull,
                itemId: itemId
            };
            _UpdateActiveTokenProgressSection(oSettings);
            _UpdatePurchaseTokenProgressSection(oSettings);
            _UpdateUseTokensProgressSection(oSettings);
        });
    }
    function _UpdateActiveTokenProgressSection(oSettings) {
        let elActivateSection = oSettings.cp.FindChildInLayoutFile('id-cart-checkout-step-activate');
        const bEnabled = oSettings.nInactiveTokens > 0 &&
            (oSettings.cp.Data().redeemableBalance < getCart(oSettings.cp).getTotalPrice());
        !oSettings.isInventoryFull &&
            getCart(oSettings.cp).getTotalPrice() > 0;
        const bHide = (getCart(oSettings.cp).getTotalItems() < 1) || (oSettings.nInactiveTokens < 1 && oSettings.nPurchaseTokens < 1);
        elActivateSection.SetHasClass('hide', bHide);
        if (bHide)
            return;
        const elPurchaseSection = oSettings.cp.FindChildInLayoutFile('id-cart-checkout-step-purchase');
        if (oSettings.nInactiveTokens > 0 || oSettings.nPurchaseTokens < 1) {
            oSettings.cp.FindChildInLayoutFile('id-cart-purchase-steps').MoveChildBefore(elActivateSection, elPurchaseSection);
            elActivateSection.FindChildInLayoutFile('id-cart-top-line').SetHasClass('hide-top-line', true);
            elPurchaseSection.FindChildInLayoutFile('id-cart-top-line').SetHasClass('hide-top-line', false);
        }
        else {
            elActivateSection.FindChildInLayoutFile('id-cart-top-line').SetHasClass('hide-top-line', false);
            elPurchaseSection.FindChildInLayoutFile('id-cart-top-line').SetHasClass('hide-top-line', true);
            oSettings.cp.FindChildInLayoutFile('id-cart-purchase-steps').MoveChildAfter(elActivateSection, elPurchaseSection);
        }
        const elBtn = elActivateSection.FindChildInLayoutFile('id-cart-activate-tokens-btn');
        const btnSettings = {
            btn: elBtn,
            tooltip: '#major_store_checkout_activate_tokens_tooltip',
            locString: $.Localize('#major_store_checkout_activate_btn'),
            loopingSound: 'UI.Laptop.ButtonFillLoop',
            timerCompleteAction: () => {
                InventoryAPI.UseTool(oSettings.itemId, '');
                elBtn.enabled = false;
                _SetCallbackTimeout(oSettings.cp, elActivateSection);
            }
        };
        HoldButton.SetupButton(btnSettings);
        elBtn.enabled = bEnabled;
        elActivateSection.SetHasClass('active', bEnabled);
    }
    function _UpdatePurchaseTokenProgressSection(oSettings) {
        const elProgressSection = oSettings.cp.FindChildInLayoutFile('id-cart-checkout-step-purchase');
        const bEnabled = oSettings.nInactiveTokens <= 0 && oSettings.nPurchaseTokens > 0 &&
            !oSettings.isInventoryFull &&
            getCart(oSettings.cp).getTotalPrice() > 0;
        const bHide = (oSettings.nPurchaseTokens <= 0 || getCart(oSettings.cp).getTotalItems() < 1);
        elProgressSection.SetHasClass('hide', bHide);
        if (bHide)
            return;
        const elBtn = elProgressSection.FindChildInLayoutFile('id-cart-buy-tokens-btn');
        elBtn.SetDialogVariable('real-price', StoreAPI.GetStoreItemTokensBundlePrice('' + g_ActiveTournamentInfo.itemid_charge, oSettings.nPurchaseTokens, ''));
        const btnSettings = {
            btn: elBtn,
            tooltip: '#major_store_checkout_purchase_tokens_tooltip' + ((oSettings.nActualNumberOfPurchaseTokensNeeded < 100) ? '100' : ''),
            locString: $.Localize('#major_store_checkout_purchase_btn', elBtn),
            loopingSound: 'UI.Laptop.ButtonFillLoop',
            timerCompleteAction: () => {
                elBtn.enabled = false;
                StoreAPI.StoreItemPurchase('' + g_ActiveTournamentInfo.itemid_charge + '(' + oSettings.nPurchaseTokens + ')');
                $.DispatchEvent("CSGOPlaySoundEffect", "UIPanorama.buymenu_purchase", "MOUSE");
            }
        };
        elBtn.enabled = bEnabled;
        HoldButton.SetupButton(btnSettings);
        elBtn.enabled = bEnabled;
        elProgressSection.SetHasClass('active', bEnabled);
    }
    function _UpdateUseTokensProgressSection(oSettings) {
        const elProgressSection = oSettings.cp.FindChildInLayoutFile('id-cart-checkout-step-use-tokens');
        const bHide = (getCart(oSettings.cp).getTotalItems() < 1);
        elProgressSection.SetHasClass('hide', bHide);
        if (bHide)
            return;
        const bEnabled = !oSettings.isInventoryFull &&
            getCart(oSettings.cp).getTotalPrice() > 0 &&
            oSettings.nPurchaseTokens <= 0 &&
            (oSettings.nInactiveTokens <= 0 || oSettings.cp.Data().redeemableBalance >= getCart(oSettings.cp).getTotalPrice());
        const elBtn = elProgressSection.FindChildInLayoutFile('id-cart-use-tokens-btn');
        const strCheckoutSuffix = oSettings.cp.GetAttributeString('checkoutsuffix', '') || '';
        const strButtonText = $.Localize('#major_store_checkout_use_tokens_btn' + strCheckoutSuffix);
        elBtn.text = strButtonText;
        const btnSettings = {
            btn: elBtn,
            tooltip: '#major_store_checkout_use_tokens_tooltip' + strCheckoutSuffix,
            locString: strButtonText,
            loopingSound: 'UI.Laptop.ButtonFillLoop',
            timerCompleteAction: () => {
                _OnAccept(oSettings.cp.Data().redeemableBalance, getCart(oSettings.cp).getTotalPrice(), oSettings.cp);
                elBtn.enabled = false;
                oSettings.cp.FindChildInLayoutFile('id-cart-close').enabled = false;
                _SetCallbackTimeout(oSettings.cp, elProgressSection);
            }
        };
        HoldButton.SetupButton(btnSettings);
        elBtn.enabled = bEnabled;
        elProgressSection.SetHasClass('active', bEnabled);
    }
    function _SetUpEmptyState(cp) {
        const items = getCart(cp).getItems();
        cp.SetHasClass('empty-cart', items.length <= 0);
    }
    function ClosePopup() {
        $.DispatchEvent('UIPopupButtonClicked', '');
        $.DispatchEvent('ContextMenuEvent', '');
        UiToolkitAPI.HideTextTooltip();
        UiToolkitAPI.HideTitleTextTooltip();
        PopupMajorStore.CancelRefreshTimerUpdate($.GetContextPanel());
    }
    PopUpShoppingCartCheckout.ClosePopup = ClosePopup;
    function _OnAccept(creditsOwned, totalPrice, cp) {
        const items = getCart(cp).getItems();
        let szPurchaseItems = '';
        if (items.length === 0) {
            getCart(cp).clearCart();
            UiToolkitAPI.ShowGenericPopupOk($.Localize('#major_store_checkout_cart_error'), $.Localize('#major_store_checkout_cart_error_desc'), '', () => $.DispatchEvent('HideContentPanel'));
            ClosePopup();
        }
        else {
            for (const item of items) {
                for (let j = 0; j < item.quantity; ++j) {
                    let purchase_id = item.checkout_id || item.id;
                    szPurchaseItems = purchase_id + (szPurchaseItems ? ',' + szPurchaseItems : '');
                }
            }
        }
        cp.FindChildInLayoutFile('id-checkout-lister').Children().forEach(entry => {
            entry.FindChildInLayoutFile('id-cart-quantity-block').hittest = false;
            entry.FindChildInLayoutFile('id-cart-quantity-block').hittestchildren = false;
        });
        MissionsAPI.ActionOperationFauxPurchase(g_ActiveTournamentInfo.credits_id, creditsOwned, totalPrice, szPurchaseItems);
    }
    function _MakeCartTiles(cp) {
        const elParent = cp.FindChildInLayoutFile('id-checkout-lister');
        const cartIds = new Set(getCart(cp).getItems().map(item => item.id));
        const aItemsNotInCart = elParent.Children().filter(tile => !cartIds.has(tile.id));
        aItemsNotInCart.forEach(tile => {
            tile.AddClass('hide-for-delete');
        });
        getCart(cp).getItems().forEach(item => {
            let elTile = elParent.FindChildInLayoutFile(item.id);
            if (!elTile) {
                elTile = $.CreatePanel('Panel', elParent, item.id);
                elTile.BLoadLayoutSnippet('cart-item');
                const itemImage = elTile.FindChildInLayoutFile('id-cart-item-image');
                itemImage.itemid = item.id;
                itemImage.SetPanelEvent('onactivate', () => {
                    if (getCart(cp) !== ShoppingCart.cart)
                        return;
                    const elPanel = UiToolkitAPI.ShowCustomLayoutPopup('', 'file://{resources}/layout/popups/popup_inventory_inspect.xml');
                    let oSettings = {
                        item_id: item.id,
                        inspect_only: true,
                        hide_all_action_items: true,
                        price_in_tokens: item.price,
                        back_to_checkout: true
                    };
                    elPanel.Data().oSettings = oSettings;
                });
                let fmtName = ItemInfo.GetFormattedName(item.id);
                fmtName.SetOnLabel(elTile.FindChildInLayoutFile('id-cart-item-name'));
                elTile.FindChildInLayoutFile('id-cart-item-add-to-cart-btn').SetPanelEvent('onactivate', () => {
                    getCart(cp).addItem(item);
                    const itemQuantity = getCart(cp).getItemQuantity(item.id);
                    elTile.SetDialogVariableInt('count', itemQuantity);
                    elTile.SetDialogVariableInt('price', getCart(cp).getItemLinePrice(item.id));
                    if (ShoppingCart.cart.getItemQuantity(item.id) >= 10 || ShoppingCart.cart.getTotalItems() >= 100) {
                        $.DispatchEvent('CSGOPlaySoundEffect', 'UIPanorama.buymenu_failure', 'MOUSE');
                        return;
                    }
                    $.DispatchEvent('CSGOPlaySoundEffect', 'UIPanorama.generic_button_press', 'MOUSE');
                });
                elTile.FindChildInLayoutFile('id-cart-item-remove-from-cart-btn').SetPanelEvent('onactivate', () => {
                    getCart(cp).decrementItem(item.id);
                    const itemQuantity = getCart(cp).getItemQuantity(item.id);
                    elTile.SetDialogVariableInt('price', getCart(cp).getItemLinePrice(item.id));
                    elTile.SetDialogVariableInt('count', itemQuantity);
                    $.DispatchEvent('CSGOPlaySoundEffect', 'UIPanorama.generic_button_press', 'MOUSE');
                });
                elTile.FindChildInLayoutFile('id-cart-item-trash-btn').SetPanelEvent('onactivate', () => {
                    getCart(cp).removeItem(item.id);
                    _SetUpEmptyState(cp);
                    _MakeCartTiles(cp);
                    $.DispatchEvent('CSGOPlaySoundEffect', 'UI.BookClose', 'MOUSE');
                });
                let isInitialSetup = true;
                let lastSeenPrice;
                const elChange = elTile.FindChildInLayoutFile('id-cart-item-price-change');
                getCart(cp).subscribeToUpdates(elTile, 'cart-item', () => {
                    if (item.oldPrice !== undefined && item.oldPrice !== item.price) {
                        const nDifference = item.price - item.oldPrice;
                        elTile.SetDialogVariableInt('price-change', Math.abs(nDifference * getCart(cp).getItemQuantity(item.id)));
                        elChange.SetHasClass('show-change', false);
                        elChange.SwitchClass('direction', item.price > item.oldPrice ? 'higher' : 'lower');
                        if (isInitialSetup || lastSeenPrice == item.price) {
                            elChange.SetHasClass('show-change', true);
                        }
                        else {
                            elTile.FindChildInLayoutFile('id-cart-item-price-loading').visible = true;
                            $.Schedule(1, () => {
                                elTile.FindChildInLayoutFile('id-cart-item-price-loading').visible = false;
                                elChange.SetHasClass('show-change', true);
                            });
                        }
                    }
                    else
                        elChange.SetHasClass('show-change', false);
                    elTile.SetDialogVariableInt('price', getCart(cp).getItemLinePrice(item.id));
                    lastSeenPrice = item.price;
                    isInitialSetup = false;
                });
                $.RegisterEventHandler('PropertyTransitionEnd', elTile, function (panelName, propertyName) {
                    if (propertyName === "opacity") {
                        if (elTile.visible === true && elTile.BIsTransparent()) {
                            elTile.DeleteAsync(0);
                        }
                    }
                });
            }
            elTile.SetDialogVariableInt('count', getCart(cp).getItemQuantity(item.id));
            elTile.SetDialogVariableInt('price', getCart(cp).getItemLinePrice(item.id));
        });
    }
    function _SetCallbackTimeout(cp, elProgressSection) {
        _CancelCallbackTimeout(cp);
        elProgressSection.SetHasClass('show-spinner', true);
        cp.Data().redeemTimeoutHandle = $.Schedule(5, () => {
            UiToolkitAPI.ShowGenericPopupOk($.Localize('#SFUI_SteamConnectionErrorTitle'), $.Localize('#SFUI_Steam_Error_LinkUnexpected'), '', () => $.DispatchEvent('HideContentPanel'));
            ClosePopup();
        });
    }
    function _CancelCallbackTimeout(cp) {
        if (cp.Data().redeemTimeoutHandle) {
            $.CancelScheduled(cp.Data().redeemTimeoutHandle);
            cp.Data().redeemTimeoutHandle = null;
            cp.FindChildInLayoutFile('id-cart-purchase-steps').FindChildrenWithClassTraverse('show-spinner').forEach(element => {
                element.SetHasClass('show-spinner', false);
            });
        }
    }
    function _ItemCustomizationNotification(numericType, type, itemid, cp) {
        if (type === 'seasontiers') {
            _CancelCallbackTimeout(cp);
            function CallAtEndAnimation() {
                Init();
                cp.FindChildInLayoutFile('id-cart-add-tokens').SetHasClass('hidden', true);
                cp.FindChildInLayoutFile('id-cart-balance').TriggerClass('popup-major-store__top-bar__balance-anim');
                _InvokeCallback(cp);
            }
            cp.FindChildInLayoutFile('id-cart-add-tokens').SetHasClass('hidden', false);
            AddMajorTokensAnim.StartAnim(cp.FindChildInLayoutFile('id-cart-add-tokens'), cp.FindChildInLayoutFile('id-cart-balance'), cp.Data().activatedCredits, CallAtEndAnimation);
            cp.Data().activatedCredits = 0;
        }
        if (type === 'reward_redeemed') {
            _CancelCallbackTimeout(cp);
            const aNewItems = AcknowledgeItems.GetItems().filter(item => (item.pickuptype
                && ['purchased'].includes(item.pickuptype)));
            if (aNewItems.length > 0) {
                getCart(cp).clearCart();
                _InvokeCallback($.GetContextPanel());
                $.DispatchEvent('ShowAcknowledgePopup', '', '');
                ClosePopup();
            }
            else {
                ClosePopup();
            }
        }
    }
    function _OnPurchaseCompletion(itemId, cp) {
        _CancelCallbackTimeout(cp);
        _AcknowledgeNewTokens(cp);
    }
    function _AcknowledgeNewTokens(cp) {
        const aNewItems = AcknowledgeItems.GetItems().filter(item => (item.pickuptype
            && ['purchased'].includes(item.pickuptype)));
        let bHasNewCredits = false;
        aNewItems.forEach(item => {
            if ((ItemInfo.ItemDefinitionNameSubstrMatch(item.id, 'tournament_pass_') && ItemInfo.ItemDefinitionNameSubstrMatch(item.id, '_credits'))) {
                InventoryAPI.AcknowledgeNewItembyItemID(item.id);
                bHasNewCredits = true;
            }
        });
        if (bHasNewCredits) {
            $.DispatchEvent('HideStoreStatusPanel');
            $.Schedule(.1, Init);
            if (!cp.Data().isFromInspect)
                _InvokeCallback($.GetContextPanel());
        }
    }
    function _InvokeCallback(cp) {
        var callbackHandle = cp.GetAttributeInt("callback", -1);
        if (callbackHandle != -1) {
            UiToolkitAPI.InvokeJSCallback(callbackHandle, '');
        }
    }
    {
        $.RegisterEventHandler('ReadyForDisplay', $.GetContextPanel(), OnReadyForDisplay);
        $.RegisterEventHandler('UnreadyForDisplay', $.GetContextPanel(), OnUnreadyForDisplay);
        $.GetContextPanel().RegisterForReadyEvents(true);
        if ($.GetContextPanel().BReadyForDisplay()) {
            OnReadyForDisplay();
        }
    }
})(PopUpShoppingCartCheckout || (PopUpShoppingCartCheckout = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9wdXBfc2hvcHBpbmdfY2FydF9jaGVja291dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL2NvbnRlbnQvY3Nnby9wYW5vcmFtYS9zY3JpcHRzL3BvcHVwcy9wb3B1cF9zaG9wcGluZ19jYXJ0X2NoZWNrb3V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxxQ0FBcUM7QUFDckMsbURBQW1EO0FBQ25ELDhFQUE4RTtBQUM5RSw0RUFBNEU7QUFDNUUsZ0RBQWdEO0FBQ2hELGlEQUFpRDtBQUNqRCwyREFBMkQ7QUFDM0QsdURBQXVEO0FBQ3ZELDREQUE0RDtBQUU1RCxJQUFVLHlCQUF5QixDQWlvQmxDO0FBam9CRCxXQUFVLHlCQUF5QjtJQUkvQixNQUFNLG1CQUFtQixHQUFHLEdBQUcsQ0FBQztJQUdoQyxTQUFTLE9BQU8sQ0FBK0IsRUFBTTtRQUVqRCxJQUFLLENBQUMsRUFBRTtZQUNKLEVBQUUsR0FBRyxDQUFDLENBQUMsZUFBZSxFQUFPLENBQUM7UUFFbEMsSUFBSSxJQUFJLEdBQUcsWUFBWSxDQUFDLElBQUksQ0FBQztRQUM3QixPQUFRLEVBQUUsRUFDVjtZQUNJLElBQUssRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLGNBQWMsQ0FBRSxNQUFNLENBQUUsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUN6RDtnQkFDSSxJQUFJLEdBQUcsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQztnQkFDdEIsTUFBTTthQUNUO1lBQ0QsRUFBRSxHQUFHLEVBQUUsQ0FBQyxTQUFTLEVBQU8sQ0FBQztTQUM1QjtRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFZRCxTQUFTLGlCQUFpQjtRQUV0QixJQUFLLENBQUMsWUFBWSxDQUFDLGVBQWUsRUFBRSxFQUMxQztZQUNVLFVBQVUsRUFBRSxDQUFDO1lBQ3RCLE9BQU87U0FDUDtRQUVLLE1BQU0sRUFBRSxHQUFHLENBQUMsQ0FB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