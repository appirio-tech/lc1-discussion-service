## Local Deploy

Make sure Postgres is running
Create a database which corresponds to your local.yaml.

Install modules:

    $ npm install

Migrate the database:

    $ grunt dbmigrate

Run the application with grunt:

    $ grunt

To see Swagger API doc, visit `http://localhost:10010/docs/` in the browser.

## API Tests with Postman

The APIs can be tested with Chrome POSTMAN plugin. The postman.json is included in the docs folder. Please import `postman.json` to POSTMAN. Import `postman_environment_10010.json` to Postman and select that environment. When testing, please change values and ids with your values.

The processing of expand parameter is added only in the `Get a Discussion` and `Get a Message` APIs. Please use the postman.json to test the expand parameter.