// @ts-check

const tba = require('./bluealliance');

const tba_api = new tba.TBA_API('QqZVQeBnh8WkhXyOoKARBVtcOtwVD3Xf4oFJhruhAk2JPZnlqYWE6KWoZGRYRuWd');

const event_id = "2018cafr";
const our_team_id = "frc2813";

/**
 * @param {string} team_id 
 * @param {string} event_id 
 * @param {number} before_match_number 
 */
async function get_matches_before(team_id, event_id, before_match_number) {
	let matches = await tba_api.get_matches_by_team_event(team_id, event_id);
	let filtered_matches = [];
	for (let match of matches) {
		if (match.match_number < before_match_number) filtered_matches.push(match);
	}
	return filtered_matches;
}

/**
 * @typedef {{[team_key:string]:tba.Match[]}} TeamMatchesMap
 * @typedef {{match:tba.Match, allies:TeamMatchesMap, opponents:TeamMatchesMap, our_alliance_color:string, opposing_alliance_color:string}} MatchScoutingInfo
 */

/**
 * @returns {Promise<MatchScoutingInfo[]>}
 */
async function get_scouting_targets() {
	let matches = await tba_api.get_matches_by_team_event(our_team_id, event_id);
	let match_promises = [];
	for (let match of matches) {
		match_promises.push(get_scouting_targets_per_match(match));
	}
	return await Promise.all(match_promises);
}

/**
 * @param {tba.Match} match
 * @returns {Promise<MatchScoutingInfo>}
 */
async function get_scouting_targets_per_match(match) {
	/** @type Object.<string, tba.Match[]> */
	let allies = {};
	/** @type Object.<string, tba.Match[]> */
	let opponents = {};
	let this_match_promises = [];
	let our_alliance_color, opposing_alliance_color;
	for (let color of ['blue', 'red']) {
		if (match.alliances[color].team_keys.includes(our_team_id)) {
			our_alliance_color = color;
			for (let team of match.alliances[color].team_keys) if (team != our_team_id) {
				this_match_promises.push(
					get_matches_before(team, event_id, match.match_number).then(filtered_matches => allies[team] = filtered_matches)
				)
			}
		}
		else {
			opposing_alliance_color = color;
			for (let team of match.alliances[color].team_keys) {
				this_match_promises.push(
					get_matches_before(team, event_id, match.match_number).then(filtered_matches => opponents[team] = filtered_matches)
				)
			}
		}
	}
	await Promise.all(this_match_promises);
	return {
		allies: allies,
		opponents: opponents,
		match: match,
		our_alliance_color: our_alliance_color,
		opposing_alliance_color: opposing_alliance_color
	};
}


/**
 * @param {tba.Match[]} matches
 */
function foo(matches) {
	let str = '';
	for (let match of matches) {
		str += `
			Match #${match.match_number} @ ${new Date(1000 * match.predicted_time).toTimeString()}`;
	}
	return str;
}

get_scouting_targets().then(matches => {
	for (let match of matches) {
		console.log(`\
match ${match.match.match_number}:`);
		console.log(`\
	our alliance (${match.our_alliance_color}):`);
		for (let ally in match.allies) {
			console.log(`\
		team ${ally}:`);
			console.log(foo(match.allies[ally]));
		}
		console.log(`\
	opposing alliance (${match.opposing_alliance_color}):`);
		for (let opponent in match.opponents) {
			console.log(`\
		team ${opponent}:`);
			console.log(foo(match.opponents[opponent]));
		}
	}
});