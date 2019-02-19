//@ts-check

const tba = require("./bluealliance");
const aaa = require("tba-api-v3client");


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

class Lookahead_Data{
	constructor(){
		/** @type {{[team_key:string]:tba.Team_Event_Status}} */
		this.team_statuses = {};
		
		/** @type {{[team_key:string]:tba.Team_Simple}} */
		this.team_infos = {};

		/** @type {string} */
		this.ally_color = null;

		/** @type {string} */
		this.opponent_color = null;

		/** @type {string[]} */
		this.ally_keys = [];
		
		/** @type {string[]} */
		this.opponent_keys = [];
		
		/** @type {string} */
		this.target_team_key = null;

		/** @type {tba.Match_Simple} */
		this.next_match = null;
	}
}

/**
 * @param {string} team_id
 * @param {string} event_id
 * @typedef {{status:tba.Team_Event_Status,info:tba.Team_Simple}} Lookahead_Team_Data
 * @returns {Promise<Lookahead_Data>}
 */
async function get_lookahead_data(team_id, event_id){
	let ret = new Lookahead_Data();
	ret.target_team_key = team_id;
	let team_status = await tba_api.get_team_status_at_event(team_id, event_id);
	ret.team_statuses[team_id] = team_status;
	let next_match;
	if(team_status != null && team_status.next_match_key != null) {
		next_match = await tba_api.get_match_simple(team_status.next_match_key);
	}
	else{
		let matches = await tba_api.get_matches_by_team_event_simple(team_id, event_id);
		if(matches != null) next_match = matches[matches.length - 1];
		else throw 'no match';
	}
	
	ret.next_match = next_match;
	
	let promises = [];

	for(let color of ['blue','red']){
		if(next_match.alliances[color].team_keys.includes(team_id)) ret.ally_color = color;
		else ret.opponent_color = color;
		for(let team of next_match.alliances[color].team_keys){
			promises.push(
				tba_api.get_team_status_at_event(team, event_id).then(status => {
					ret.team_statuses[team] = status;
				})
			);
			promises.push(
				tba_api.get_team_info_simple(team).then(info => {
					ret.team_infos[team] = info;
				})
			);
		}
	}
	
	for(let ally of next_match.alliances[ret.ally_color].team_keys) ret.ally_keys.push(ally);
	for(let opponent of next_match.alliances[ret.opponent_color].team_keys) ret.opponent_keys.push(opponent);

	await Promise.all(promises);

	return ret;
}

get_lookahead_data('frc2813','2018cafr').then(data=>{
	if(data == null) {
		console.error('data is null');
		return;
	}
	else{
		// console.log(data);
		let target_team_info = data.team_infos[data.target_team_key];
		let target_team_status = data.team_statuses[data.target_team_key];
		console.log(`team ${target_team_info.team_number} - ${target_team_info.nickname}`);
		console.log(`next match is match #${data.next_match.match_number}`);
		console.log(`allies:`);
		for(let key of data.ally_keys){
			let info = data.team_infos[key];
			let status = data.team_statuses[key];
			console.log(`	${status.overall_status_str}`);
		}
		console.log(`opponents:`)
		for(let key of data.opponent_keys){
			let info = data.team_infos[key];
			let status = data.team_statuses[key];
			console.log(`	${status.overall_status_str}`);
		}
	}
});