const bluealliance = require('./bluealliance');

const tba = new bluealliance.TBA_API('QqZVQeBnh8WkhXyOoKARBVtcOtwVD3Xf4oFJhruhAk2JPZnlqYWE6KWoZGRYRuWd');

const event_id = "2018cafr";
const our_team_id = "frc2813";

async function get_matches_before(team_id, event_id, before_match_number) {
	let matches = await tba.get_matches_by_team_event(team_id, event_id);
	let filtered_matches = [];
	for (match of matches) {
		if (match.match_number < before_match_number) filtered_matches.push(match);
	}
	return filtered_matches;
}

async function get_scouting_targets() {
	let matches = await tba.get_matches_by_team_event(our_team_id, event_id);
	let match_promises = [];
	for (let match of matches) {
		match_promises.push(get_scouting_targets_per_match(match, our_team_id));
	}
	return await Promise.all(match_promises);
}

async function get_scouting_targets_per_match(match) {
	let allies = {}, opponents = {};
	let this_match_promises = [];
	let match_number = match.match_number;
	for (let color of ['blue', 'red']) {
		if (match.alliances[color].team_keys.includes(our_team_id)) {
			console.log(`${match_number} we are on the ${color} alliance`);
			for (team of match.alliances[color].team_keys) if (team != our_team_id) {
				this_match_promises.push(
					get_matches_before(team, event_id, match_number).then(filtered_matches => opponents[team] = filtered_matches)
				)
			}
		}
		else {
			console.log(`${match_number} we are NOT on the ${color} alliance`);
			for (let team of match.alliances[color].team_keys) {
				this_match_promises.push(
					get_matches_before(team, event_id, match_number).then(filtered_matches => opponents[team] = filtered_matches)
				)
			}
		}
	}
	await Promise.all(this_match_promises);
	return { allies: allies, opponents: opponents };
}

get_scouting_targets().then(matches => {
	for (let match of matches) {
		console.log(match);
	}
});