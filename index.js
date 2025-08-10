const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const dotenv = require("dotenv");
dotenv.config();
const cors = require("cors");

// Initialize Express app
const app = express();
app.use(
	cors({
		origin: ["http://localhost:3000", "https://courier-path.vercel.app", '*'],
		credentials: true,
	})
);
app.use(express.json());

console.log(process.env.MONGO_URL)
// MongoDB connection
let db;
const connectDB = async () => {
	try {
		const client = new MongoClient(
			process.env.MONGO_URL,
			{
				useNewUrlParser: true,
				useUnifiedTopology: true,
			}
		);
		await client.connect();

		// Test the connection
		await client.db("admin").command({ ping: 1 });
		console.log(
			"Pinged your deployment. You successfully connected to MongoDB!"
		);

		// Set the database
		db = client.db("country");
		console.log('Connected to MongoDB and using "country" database');

		return client;
	} catch (error) {
		console.error("MongoDB connection error:", error);
		process.exit(1);
	}
};

// Helper function to get translated name
const getTranslatedName = (item, lang) => {
	if (!lang || !item.translations) return item.name;
	return item.translations[lang] || item.name;
};

// Helper function for case-insensitive search
const createSearchRegex = (searchTerm) => new RegExp(searchTerm, "i");

// Test route
app.get("/", (req, res) => {
	res.json({
		message: "Geographic API is running",
		timestamp: new Date().toISOString(),
	});
});

// REGIONS ROUTES
app.get("/regions", async (req, res) => {
	try {
		const { lang } = req.query;
		const regions = await db.collection("regions").find({}).toArray();

		const response = regions.map((region) => ({
			...region,
			name: getTranslatedName(region, lang),
		}));

		res.json(response);
	} catch (error) {
		res.status(500).json({ error: "Failed to fetch regions" });
	}
});

app.get("/regions/:continentId", async (req, res) => {
	try {
		const { continentId } = req.params;
		const { lang } = req.query;

		const region = await db.collection("regions").findOne({
			id: parseInt(continentId),
		});

		if (!region) {
			return res.status(404).json({ error: "Region not found" });
		}

		const response = {
			...region,
			name: getTranslatedName(region, lang),
		};

		res.json(response);
	} catch (error) {
		res.status(500).json({ error: "Failed to fetch region details" });
	}
});

app.get("/regions/:continentId/countries", async (req, res) => {
	try {
		const { continentId } = req.params;
		const { lang } = req.query;

		const countries = await db
			.collection("countries")
			.find({
				region_id: parseInt(continentId),
			})
			.toArray();

		const response = countries.map((country) => ({
			...country,
			name: getTranslatedName(country, lang),
		}));

		res.json(response);
	} catch (error) {
		res.status(500).json({ error: "Failed to fetch countries in region" });
	}
});

// COUNTRIES ROUTES
app.get("/countries", async (req, res) => {
	try {
		const { name, lang } = req.query;
		let query = {};

		if (name) {
			query.$or = [
				{ name: createSearchRegex(name) },
				{ native: createSearchRegex(name) },
			];

			if (lang && lang !== "en") {
				query.$or.push({ [`translations.${lang}`]: createSearchRegex(name) });
			}
		}

		const countries = await db.collection("countries").find(query).toArray();

		const response = countries.map((country) => ({
			...country,
			name: getTranslatedName(country, lang),
		}));

		res.json(response);
	} catch (error) {
		res.status(500).json({ error: "Failed to fetch countries" });
	}
});

app.get("/countries/code/:iso2", async (req, res) => {
	try {
		const { iso2 } = req.params;
		const { lang } = req.query;

		const country = await db.collection("countries").findOne({
			iso2: iso2.toUpperCase(),
		});

		if (!country) {
			return res.status(404).json({ error: "Country not found" });
		}

		const response = {
			...country,
			name: getTranslatedName(country, lang),
		};

		res.json(response);
	} catch (error) {
		res.status(500).json({ error: "Failed to fetch country" });
	}
});

app.get("/countries/:countryId", async (req, res) => {
	try {
		const { countryId } = req.params;
		const { lang } = req.query;

		const country = await db.collection("countries").findOne({
			id: parseInt(countryId),
		});

		if (!country) {
			return res.status(404).json({ error: "Country not found" });
		}

		const response = {
			...country,
			name: getTranslatedName(country, lang),
		};

		res.json(response);
	} catch (error) {
		res.status(500).json({ error: "Failed to fetch country details" });
	}
});

app.get("/countries/:countryId/states", async (req, res) => {
	try {
		const { countryId } = req.params;

		const states = await db
			.collection("states")
			.find({
				country_id: parseInt(countryId),
			})
			.toArray();

		res.json(states);
	} catch (error) {
		res.status(500).json({ error: "Failed to fetch states in country" });
	}
});

app.get("/countries/:countryId/cities", async (req, res) => {
	try {
		const { countryId } = req.params;
		const { limit = 100, offset = 0 } = req.query;

		const cities = await db
			.collection("cities")
			.find({
				country_id: parseInt(countryId),
			})
			.skip(parseInt(offset))
			.limit(parseInt(limit))
			.toArray();

		res.json(cities);
	} catch (error) {
		res.status(500).json({ error: "Failed to fetch cities in country" });
	}
});

// STATES ROUTES
app.get("/states", async (req, res) => {
	try {
		const { country_id, limit = 100, offset = 0 } = req.query;
		let query = {};

		if (country_id) {
			query.country_id = parseInt(country_id);
		}

		const states = await db
			.collection("states")
			.find(query)
			.skip(parseInt(offset))
			.limit(parseInt(limit))
			.toArray();

		res.json(states);
	} catch (error) {
		res.status(500).json({ error: "Failed to fetch states" });
	}
});

app.get("/states/:stateId", async (req, res) => {
	try {
		const { stateId } = req.params;

		const state = await db.collection("states").findOne({
			id: parseInt(stateId),
		});

		if (!state) {
			return res.status(404).json({ error: "State not found" });
		}

		res.json(state);
	} catch (error) {
		res.status(500).json({ error: "Failed to fetch state details" });
	}
});

app.get("/states/:stateId/cities", async (req, res) => {
	try {
		const { stateId } = req.params;
		const { limit = 100, offset = 0 } = req.query;

		const cities = await db
			.collection("cities")
			.find({
				state_id: parseInt(stateId),
			})
			.skip(parseInt(offset))
			.limit(parseInt(limit))
			.toArray();

		res.json(cities);
	} catch (error) {
		res.status(500).json({ error: "Failed to fetch cities in state" });
	}
});

// CITIES ROUTES
app.get("/cities", async (req, res) => {
	try {
		const { name, country_id, state_id, limit = 100, offset = 0 } = req.query;

		let query = {};

		if (name) {
			query.name = createSearchRegex(name);
		}

		if (country_id) {
			query.country_id = parseInt(country_id);
		}

		if (state_id) {
			query.state_id = parseInt(state_id);
		}

		const cities = await db
			.collection("cities")
			.find(query)
			.skip(parseInt(offset))
			.limit(parseInt(limit))
			.toArray();

		res.json(cities);
	} catch (error) {
		res.status(500).json({ error: "Failed to fetch cities" });
	}
});

app.get("/cities/:cityId", async (req, res) => {
	try {
		const { cityId } = req.params;

		const city = await db.collection("cities").findOne({
			id: parseInt(cityId),
		});

		if (!city) {
			return res.status(404).json({ error: "City not found" });
		}

		res.json(city);
	} catch (error) {
		res.status(500).json({ error: "Failed to fetch city details" });
	}
});

// SEARCH ROUTE
app.get("/search", async (req, res) => {
	try {
		const { q, type, lang, limit = 50 } = req.query;

		if (!q) {
			return res
				.status(400)
				.json({ error: "Search query (q) parameter is required" });
		}

		const searchRegex = createSearchRegex(q);
		const results = {
			countries: [],
			states: [],
			cities: [],
			regions: [],
		};

		if (!type || type === "countries") {
			const countryQuery = {
				$or: [
					{ name: searchRegex },
					{ native: searchRegex },
					{ iso2: searchRegex },
					{ iso3: searchRegex },
				],
			};

			if (lang) {
				countryQuery.$or.push({ [`translations.${lang}`]: searchRegex });
			}

			results.countries = await db
				.collection("countries")
				.find(countryQuery)
				.limit(parseInt(limit))
				.toArray();

			if (lang) {
				results.countries = results.countries.map((country) => ({
					...country,
					name: getTranslatedName(country, lang),
				}));
			}
		}

		if (!type || type === "states") {
			results.states = await db
				.collection("states")
				.find({ name: searchRegex })
				.limit(parseInt(limit))
				.toArray();
		}

		if (!type || type === "cities") {
			results.cities = await db
				.collection("cities")
				.find({ name: searchRegex })
				.limit(parseInt(limit))
				.toArray();
		}

		if (!type || type === "regions") {
			const regionQuery = {
				$or: [{ name: searchRegex }],
			};

			if (lang) {
				regionQuery.$or.push({ [`translations.${lang}`]: searchRegex });
			}

			results.regions = await db
				.collection("regions")
				.find(regionQuery)
				.limit(parseInt(limit))
				.toArray();

			if (lang) {
				results.regions = results.regions.map((region) => ({
					...region,
					name: getTranslatedName(region, lang),
				}));
			}
		}

		res.json(results);
	} catch (error) {
		res.status(500).json({ error: "Search failed" });
	}
});

// Error handling middleware
app.use((err, req, res, next) => {
	console.error(err.stack);
	res.status(500).json({ error: "Something went wrong!" });
});

// 404 handler - simplified
app.use((req, res) => {
	res.status(404).json({ error: "Route not found" });
});

// Start server
const PORT = process.env.PORT || 3000;

connectDB()
	.then(() => {
		app.listen(PORT, () => {
			console.log(`Geographic API server running on port ${PORT}`);
			console.log("Available endpoints:");
			console.log("  GET /");
			console.log("  GET /regions");
			console.log("  GET /regions/:continentId");
			console.log("  GET /regions/:continentId/countries");
			console.log("  GET /countries");
			console.log("  GET /countries/code/:iso2");
			console.log("  GET /countries/:countryId");
			console.log("  GET /countries/:countryId/states");
			console.log("  GET /countries/:countryId/cities");
			console.log("  GET /states");
			console.log("  GET /states/:stateId");
			console.log("  GET /states/:stateId/cities");
			console.log("  GET /cities");
			console.log("  GET /cities/:cityId");
			console.log("  GET /search");
		});
	})
	.catch(console.error);

module.exports = app;
