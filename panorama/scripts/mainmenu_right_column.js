'use strict';

var MainMenuRightColumn = ( function(){

    function _UpdateFakeVanity() {
        let globalObject = UiToolkitAPI.GetGlobalObject();

        let weapon = $.GetContextPanel().FindChildTraverse("fakevanity_weapon").text;
        let glove = $.GetContextPanel().FindChildTraverse("fakevanity_glove").text;
        let agent = $.GetContextPanel().FindChildTraverse("fakevanity_agent").text;
        let team = $.GetContextPanel().FindChildTraverse("fakevanity_team").text;

        globalObject.fakevanitysettings = {
            gloves: glove,
            weapon: weapon,
            team: team,
            agent: agent
        }
        $.DispatchEvent( 'OpenStatsMenu' );
    }

    function _ShowHideFakeVanityFields() {
        $.GetContextPanel().FindChildTraverse('fakevanityentrys').visible = !$.GetContextPanel().FindChildTraverse('fakevanityentrys').visible;
    }

	return {
        UpdateFakeVanity: _UpdateFakeVanity,
        ShowHideFakeVanityFields: _ShowHideFakeVanityFields
	};

})();