//@ts-check

const http = require('http');
const https = require('https');
const fs = require('fs');
const util = require('util');

const debug = false;

const baseURL = 'https://www.thebluealliance.com/api/v3/';

const tbaCacheLocation = 'tba_cache/';



/**
 * @returns {Promise<[http.IncomingMessage, string]>}
 */
function httpsGetPromise(url, options = {}) {
	return new Promise((resolve, reject) => {
		https.get(url, options, response => {
			let body = '';
			response.on('data', chunk => body += chunk);
			response.on('end', () => resolve([response, body]));
		});
	});
}

class TBA_API {
	constructor(apiKey) {
		this.apiKey = apiKey;
	}

	/**
	 * @param {string} path 
	 * @returns {Promise<>}
	 * @memberof TBA_API
	 */
	async tba_request(path) {
		let request_url = baseURL + path;
		let request_options = { headers: { "X-TBA-Auth-Key": this.apiKey } };
		let cache_path = tbaCacheLocation + path;
		if (!fs.existsSync(cache_path)) fs.mkdirSync(cache_path, { recursive: true });
		let cache_response_path = `${cache_path}/response.json`
		let cache_info_path = `${cache_path}/cache_info.json`
		if (fs.existsSync(cache_info_path) && fs.existsSync(cache_response_path)) { //have cached version
			if (debug) console.log('had cache file')
			// let cached_response = await fs.promises.readFile(cache_response_path).then(data=>JSON.parse(data));
			let cached_info = await fs.promises.readFile(cache_info_path).then(data => JSON.parse(data.toString()));

			// if(new Date(cached_info.valid_until) < new Date()){
			// 	console.log('max-age has not yet passed, returning cached file');
			// 	return fs.promises.readFile(cache_response_path).then(data=>JSON.parse(data));
			// }

			request_options.headers['If-Modified-Since'] = cached_info.last_modified;
			let [response, response_body] = await httpsGetPromise(request_url, request_options);
			if (response.statusCode == 304) { // cache is still fine
				if (debug) console.log('cache still fine, returning cached file');
				return fs.promises.readFile(cache_response_path).then(data => JSON.parse(data.toString()));
			}
			else if (response.statusCode == 200) {
				if (debug) console.log('cache outdated, updating cache');
				fs.promises.writeFile(cache_response_path, response_body, { flag: 'w' });
				fs.promises.writeFile(cache_info_path, JSON.stringify({
					last_modified: response.headers['last-modified'],
				}), { flag: 'w' });
				return JSON.parse(response_body);
			}
			else {
				console.error(`status code: ${response.statusCode}`);
				return null;
			}
		}
		else { // don't have cached version
			if (debug) console.log('no cache file');
			let [response, response_body] = await httpsGetPromise(request_url, request_options);
			fs.promises.writeFile(cache_response_path, response_body, { flag: 'w' });
			// let maxAge = parseFloat(response.headers['cache-control'].match(/max-age=(?<maxage>[0-9]+)/).groups.maxage);
			// let validUntil = new Date();
			// console.log(maxAge);
			// validUntil.setSeconds(validUntil.getSeconds() + maxAge);
			fs.promises.writeFile(cache_info_path, JSON.stringify({
				last_modified: response.headers['last-modified'],
				// valid_until:validUntil.toJSON()
			}), { flag: 'w' });
			return JSON.parse(response_body);
		}
	}

	/**
	 * @param {string} team_key
	 * @param {string} event_key
	 * @returns {Promise<Match[]>}
	 * @memberof TBA_API
	 */
	async get_matches_by_team_event(team_key, event_key) {
		return (await this.tba_request(`team/${team_key}/event/${event_key}/matches`)).map(data => new Match(data));
	}

	/**
	 * @param {string} team_key
	 * @param {string} event_key
	 * @returns {Promise<Match_Simple[]>}
	 * @memberof TBA_API
	 */
	async get_matches_by_team_event_simple(team_key, event_key) {
		return (await this.tba_request(`team/${team_key}/event/${event_key}/matches/simple`)).map(data => new Match_Simple(data));
	}

	/**
	 * @param {string} event_key
	 * @returns {Promise<Match[]>}
	 * @memberof TBA_API
	 */
	async get_matches_by_event(event_key) {
		return (await this.tba_request(`event/${event_key}/matches`)).map(data => new Match(data));
	}

	/**
	 * @param {string} match_key
	 * @returns {Promise<Match>}
	 * @memberof TBA_API
	 */
	async get_match(match_key){
		return new Match(await this.tba_request(`match/${match_key}`));
	}
	
	/**
	 * @param {string} match_key
	 * @returns {Promise<Match_Simple>}
	 * @memberof TBA_API
	 */
	async get_match_simple(match_key){
		return new Match_Simple(await this.tba_request(`match/${match_key}/simple`));
	}

	/**
	 * @param {string} team_key
	 * @param {string} event_key
	 * @returns {Promise<Team_Event_Status>}
	 * @memberof TBA_API
	 */
	async get_team_status_at_event(team_key, event_key){
		return new Team_Event_Status(await this.tba_request(`team/${team_key}/event/${event_key}/status`));
	}

	async get_status() {
		return this.tba_request(`status`);
	}

	async get_teams_by_page(page_num) {
		return (await this.tba_request(`teams/${page_num}`)).map(data => new Team(data));
	}
}

exports.TBA_API = TBA_API;

//#region team

class Team_Simple{
	constructor(data){
		/** @type {string} */
		this.key = data.key;

		/** @type {number} */
		this.team_number = data.team_number;

		/** @type {string} */
		this.nickname = data.nickname;

		/** @type {string} */
		this.name = data.name;

		/** @type {string} */
		this.city = data.city;

		/** @type {string} */
		this.state_prov = data.state_prov;

		/** @type {string} */
		this.country = data.country;

	}
}

exports.Team_Simple = Team_Simple;

class Team extends Team_Simple{
	constructor(data) {
		super(data);

		/** @type {string} */
		this.address = data.address;

		/** @type {string} */
		this.postal_code = data.postal_code;

		/** @type {string} */
		this.gmaps_place_id = data.gmaps_place_id;

		/** @type {string} */
		this.gmaps_url = data.gmaps_url;

		/** @type {number} */
		this.lat = data.lat;

		/** @type {number} */
		this.lng = data.lng;

		/** @type {string} */
		this.location_name = data.location_name;

		/** @type {string} */
		this.website = data.website;

		/** @type {number} */
		this.rookie_year = data.rookie_year;

		/** @type {string} */
		this.motto = data.motto;

		/** @type {{[year:string]:string}} */
		this.home_championship = data.home_championship;
	}
}

exports.Team = Team;

//#endregion

//#region team event status

class Team_Event_Status{
	constructor(data){
		/** @type {Team_Event_Status_rank} */
		this.qual = new Team_Event_Status_rank(data.qual);

		/** @type {Team_Event_Status_alliance} */
		this.alliance = new Team_Event_Status_rank(data.alliance);

		/** @type {Team_Event_Status_playoff} */
		this.playoff = new Team_Event_Status_playoff(data.playoff);

		/**
		 * An HTML formatted string suitable for display to the user containing the team’s alliance pick status.
		 * @type {string}
		 */
		this.alliance_status_str = data.alliance_status_str;

		/**
		 * An HTML formatted string suitable for display to the user containing the team’s playoff status.
		 * @type {string}
		 */
		this.playoff_status_str = data.playoff_status_str;

		/**
		 * An HTML formatted string suitable for display to the user containing the team’s overall status summary of the event.
		 * @type {string}
		 */
		this.overall_status_str = data.overall_status_str;

		/**
		 * TBA match key for the next match the team is scheduled to play in at this event, or null.
		 * @type {string}
		 */
		this.next_match_key = data.next_match_key;

		/**
		 * TBA match key for the last match the team played in at this event, or null.
		 * @type {string}
		 */
		this.last_match_key = data.last_match_key;

	}
}

exports.Team_Event_Status = Team_Event_Status;

class Team_Event_Status_rank{
	constructor(data){
		/**
		 * Number of teams ranked.
		 * @type {*}
		 */
		this.num_teams = data.num_teams;
		
		/**
		 * @type {Team_Event_Status_rank_ranking}
		 */
		this.ranking = data.ranking;
		
		/**
		 * Ordered list of names corresponding to the elements of the sort_orders array.
		 * @type {{name:string, precision:number}}
		 */
		this.sort_order_info = data.sort_order_info;
		
		/**
		 * @type {*}
		 */
		this.status = data.status;
		
	}
}

exports.Team_Event_Status_rank = Team_Event_Status_rank;

class Team_Event_Status_rank_ranking{
	constructor(data){
		/**
		 * Number of matches the team was disqualified for.
		 * @type {number}
		 */
		this.dq = data.dq;

		/**
		 * Number of matches played.
		 * @type {number}
		 */
		this.matches_played = data.matches_played;

		/**
		 * For some years, average qualification score. Can be null.
		 * @type {number}
		 */
		this.qual_average = data.qual_average;

		/**
		 * Relative rank of this team.
		 * @type {number}
		 */
		this.rank = data.rank;

		/**
		 * A Win-Loss-Tie record for a team, or an alliance.
		 * @type {*}
		 */
		//TODO WLT_Record class
		this.record = data.record;

		/**
		 * Ordered list of values used to determine the rank. See the sort_order_info property for the name of each value.
		 * @type {number[]}
		 */
		this.sort_orders = data.sort_orders;

		/**
		 * TBA team key for this rank.
		 * @type {string}
		 */
		this.team_key = data.team_key;

	}
}

exports.Team_Event_Status_rank_ranking = Team_Event_Status_rank_ranking;

class Team_Event_Status_alliance{
	constructor(data){
		//TODO
	}
}

exports.Team_Event_Status_alliance = Team_Event_Status_alliance;

class Team_Event_Status_playoff{
	constructor(data){
		//TODO
	}
}

exports.Team_Event_Status_playoff = Team_Event_Status_playoff;

//#endregion

//#region match

class Match_Simple {
	constructor(data) {
		/** @type string */
		this.key = data.key;

		/** @type string */
		this.comp_level = data.comp_level;

		/** @type number */
		this.set_number = data.set_number;

		/** @type number */
		this.match_number = data.match_number;

		/** @type {{[color:string]:Match_alliance, blue:Match_alliance, red:Match_alliance}} */
		this.alliances = {
			blue: new Match_alliance(data.alliances.blue),
			red: new Match_alliance(data.alliances.red),
		};

		/**
		 * The color (red/blue) of the winning alliance.
		 * Will contain an empty string in the event of no winner, or a tie.
		 * @type string
		 */
		this.winning_alliance = data.winning_alliance;

		/** @type string */
		this.event_key = data.event_key;

		/** @type number */
		this.time = data.time;

		/** @type number */
		this.actual_time = data.actual_time;

		/** @type number */
		this.predicted_time = data.predicted_time;
	}
}

exports.Match_Simple = Match_Simple;

class Match extends Match_Simple {
	constructor(data) {
		super(data);

		/** @type number */
		this.post_result_time = data.post_result_time;

		this.score_breakdown = data.score_breakdown;

		this.videos = data.videos;
	}
}

exports.Match = Match;

class Match_alliance {
	constructor(data) {
		/** @type number */
		this.score = data.score;
		if (data.score == -1) this.score = null;

		/** @type string[] */
		this.team_keys = data.team_keys;

		/** @type string[] */
		this.surrogate_team_keys = data.surrogate_team_keys;

		/** @type string[] */
		this.dq_team_keys = data.dq_team_keys;

	}
}

exports.Match_alliance = Match_alliance;

//#endregion