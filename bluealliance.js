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
			console.log('had cache file')
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
	 */
	async get_matches_by_team_event(team_key, event_key) {
		return this.tba_request(`team/${team_key}/event/${event_key}/matches`);
	}

	/**
	 * @param {string} event_key
	 * @returns {Promise<Match[]>}
	 */
	async get_matches_by_event(event_key) {
		return this.tba_request(`event/${event_key}/matches`);
	}

	async get_status() {
		return this.tba_request(`status`);
	}

	async get_teams_by_page(page_num) {
		return this.tba_request(`teams/${page_num}`);
	}

	async get_status_by_team_event(team_key, event_key) {
		return this.tba_request(`team/${team_key}/event/${event_key}/status`);
	}
}

//#region models

/**
 * @param {object[]} matches
 * @returns {Match[]} array of Match objects
 */
function match_array(matches) {
	return matches.map(match => new Match(match));
}

class Match {
	constructor(data) {
		/** @type string */
		this.key = data.key;

		/** @type string */
		this.comp_level = data.comp_level;

		/** @type number */
		this.set_number = data.set_number;

		/** @type number */
		this.match_number = data.match_number;

		/** @type {{blue:Match_alliance, red:Match_alliance}} */
		this.alliances = {
			blue: new Match_alliance(data.alliances.blue),
			red: new Match_alliance(data.alliances.red),
		};

		/** @type string */
		this.winning_alliance = data.winning_alliance;

		/** @type string */
		this.event_key = data.event_key;

		/** @type number */
		this.time = data.time;

		/** @type number */
		this.actual_time = data.actual_time;

		/** @type number */
		this.predicted_time = data.predicted_time;

		/** @type number */
		this.post_result_time = data.post_result_time;

		this.score_breakdown = data.score_breakdown;

		this.videos = data.videos;
	}
}

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

//#endregion

exports.TBA_API = TBA_API;
exports.Match = Match;
exports.Match_alliance = Match_alliance;