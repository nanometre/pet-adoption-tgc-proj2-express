const validate = require('./middleware/validate')
const schema = require('./schema/animal-schema')
const MongoUtil = require('./MongoUtil.js');
const express = require('express');
const cors = require('cors');
const ObjectId = require('mongodb').ObjectId;
const dotenv = require('dotenv');
dotenv.config();

let app = express();
app.use(express.json());
app.use(cors());

const mongoUri = process.env.MONGO_URI;
const COLLECTION_NAME = 'animals';

// res.json is only needed for POST and PUT requests
// res.json is not needed for GET and DELETE requests
async function main() {
    await MongoUtil.connect(mongoUri, 'pet_adoption')

    // Default page
    app.get("/", function (req, res) {
        try {
            res.send("Express app is functional")
        } catch (err) {
            res.status(500)
            res.send("Internal server error. Please contact administrator.")
        }
    })

    // POST: Add new animals in the DB (CREATE)
    app.post("/animals", validate.validate(schema.postAnimalSchema), async function (req, res) {
        try {
            let db = MongoUtil.getDB();

            let name = req.body.name;
            let img_url = req.body.img_url;
            let gender = req.body.gender;
            let date_of_birth = req.body.date_of_birth;
            let species = req.body.species;
            let status_tags = req.body.status_tags;
            let description = req.body.description;
            let adopt_foster = req.body.adopt_foster;
            let _id;
            let caretaker_name = req.body.current_caretaker.caretaker_name;
            let email = req.body.current_caretaker.email;

            let animalRecord = await db.collection(COLLECTION_NAME)
                .findOne({
                    "current_caretaker.email": {
                        '$regex': email,
                        '$options': 'i'
                    }
                });
            if (!animalRecord) {
                _id = new ObjectId()
            } else {
                _id = ObjectId(animalRecord.current_caretaker._id)
            }

            let current_caretaker = { _id, caretaker_name, email };

            await db.collection(COLLECTION_NAME).insertOne({
                name, img_url, gender, date_of_birth, species, status_tags,
                description, adopt_foster, current_caretaker
            })
            res.send("New animal added")
        } catch (err) {
            res.status(500)
            res.send("Internal server error. Please contact administrator.")
        }

    })

    // GET: Return all animals in the DB (READ)
    // To buff up search criteria (search by date)
    app.get("/animals", async function (req, res) {
        try {
            let criteria = {};
            if (req.query.searchterm) {
                criteria['$or'] = [
                    {
                        'name': {
                            '$regex': `${req.query.searchterm}`,
                            '$options': 'i'
                        }
                    },
                    {
                        'species.breed': {
                            '$regex': `${req.query.searchterm}`,
                            '$options': 'i'
                        }
                    },
                    {
                        'description': {
                            '$regex': `${req.query.searchterm}`,
                            '$options': 'i'
                        }
                    }
                ]
            };
            if (req.query.gender) {
                criteria['gender'] = {
                    '$regex': `^${req.query.gender}$`,
                    '$options': 'i'
                }
            };
            if (req.query.species_name) {
                criteria['species.species_name'] = {
                    '$regex': `^${req.query.species_name}$`,
                    '$options': 'i'
                }
            };
            if (req.query.status_tags) {
                criteria['status_tags'] = {
                    // use $all (match all in arr) or $in (match either one in arr)
                    '$in': req.query.status_tags.toUpperCase().split(',')
                }
            };
            if (req.query.adopt_foster) {
                let adoptFosterArr = []
                for (let w of req.query.adopt_foster.split(',')) {
                    adoptFosterArr.push(w.charAt(0).toUpperCase() + w.slice(1))
                }
                criteria['adopt_foster'] = {
                    '$in': adoptFosterArr
                }
            };
            if (req.query.email) {
                criteria['current_caretaker.email'] = {
                    '$regex': `^${req.query.email}$`,
                    '$options': 'i'
                }
            } 

            let db = MongoUtil.getDB();
            let queryResults = await db.collection(COLLECTION_NAME)
                .find(criteria)
                .toArray()

            res.json(queryResults)
        } catch (err) {
            res.status(500)
            res.send("Internal server error. Please contact administrator.")
        }
    })

    // GET: Return one animal in the DB by ID (READ)
    // Might not be require, better to find by search terms.
    // But there might be cases on the backend I would like to retreive the data using the _id. 
    app.get("/animals/:_id", validate.validate(schema.animalIdSchema), async function (req, res) {
        try {
            let db = MongoUtil.getDB();
            let animalRecord = await db.collection(COLLECTION_NAME)
                .findOne({
                    _id: new ObjectId(req.params._id)
                });
            res.json(animalRecord)
        } catch (err) {
            res.status(500)
            res.send("Internal server error. Please contact administrator.")
        }
    })

    // PUT: Edit animals in DB by ID (UPDATE)
    app.put("/animals/:_id", validate.validate(schema.putAnimalSchema), async function (req, res) {
        try {
            let {
                name, img_url, gender, date_of_birth, species, status_tags,
                description, adopt_foster, current_caretaker
            } = req.body
            let db = MongoUtil.getDB();
            let updateAnimalRecord = await db.collection(COLLECTION_NAME)
                .updateOne({
                    _id: ObjectId(req.params._id)
                }, {
                    $set: {
                        name, img_url, gender, date_of_birth, species,
                        status_tags, description, adopt_foster, current_caretaker
                    }
                })
            res.send(`Animal record (ID: ${req.params._id}) updated`)
        } catch (err) {
            res.status(500)
            res.send("Internal server error. Please contact administrator.")
        }
    })

    // DELETE: Delete animals in DB by ID (DELETE)
    app.delete("/animals/:_id", validate.validate(schema.animalIdSchema), async function (req, res) {
        try {
            let db = MongoUtil.getDB()
            await db.collection(COLLECTION_NAME).deleteOne({
                _id: ObjectId(req.params._id)
            });
            res.send(`Animal record (ID: ${req.params._id}) deleted`)
        } catch (err) {
            res.status(500)
            res.send("Internal server error. Please contact administrator.")
        }
    })

    // Deployment port: process.env.PORT
    // Testing port: 8888
    app.listen(process.env.PORT, () => {
        console.log('Server has started')
    })
}

main();