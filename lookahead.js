//@ts-check

const tba = require("./bluealliance");

const tba_api = new tba.TBA_API('ERTVm2R0UrDuhurmGPGzLXRufJ5fEM6EH3nzvAuud3FWYt4GTUNKk69XtbBxZ7Or');

/*
url:
/lookahead/event_id/team_id
or
/lookahead/team_id/event_id
or
/lookahead?team_id=team_id&event_id=event_id


auto refresh page (or just content) about every 60 seconds
*/

/**
 * @param {string} team_id
 * @param {string} event_id
 * @returns {Promise<{ally_color:string,opponent_color:string,team_status:tba.Team_Event_Status,next_match:tba.Match_Simple,allies:{[team_key:string]:{status:tba.Team_Event_Status}},opponents:{[team_key:string]:{status:tba.Team_Event_Status}}}>}
 */
async function get_lookahead_data(team_id, event_id){
	let team_status = await tba_api.get_team_status_at_event(team_id, event_id);
	let next_match = await tba_api.get_match_simple(team_status.next_match_key);
	
	/** @type {{[team_key:string]:{status:tba.Team_Event_Status}}} */
	let allies = {};
	/** @type {{[team_key:string]:{status:tba.Team_Event_Status}}} */
	let opponents = {};
	
	/** @type {string} */
	let ally_color;
	/** @type {string} */
	let opponent_color;
	
	for(let color of ['blue','red']){
		if(next_match.alliances.red.team_keys.includes(team_id)) ally_color = color;
		else opponent_color = color;
	}
	//TODO null check ally color

	let status_promises = [];

	for(let ally of next_match.alliances[ally_color].team_keys){
		allies[ally] = {status:null};
		status_promises.push(
			tba_api.get_team_status_at_event(ally, event_id).then(status=>{
				allies[ally].status = status
			})
		);
	}
	for(let opponent of next_match.alliances[opponent_color].team_keys){
		opponents[opponent] = {status:null};
		status_promises.push(
			tba_api.get_team_status_at_event(opponent, event_id).then(status=>{
				opponents[opponent].status = status
			})
		);
	}

	await Promise.all(status_promises);

	return {
		ally_color:ally_color,
		opponent_color:opponent_color,
		team_status:team_status,
		next_match:next_match,
		allies:allies,
		opponents:opponents
	};
}