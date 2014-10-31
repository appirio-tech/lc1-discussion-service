## Configuration

Configuration is stored in the /config/*.yaml files.  The [node config](https://github.com/lorenwest/node-config) module is used to load configuration.

Please see the config documentation:  https://github.com/lorenwest/node-config/wiki

The "local" config files are all ignored in git.

Configuration:

```yaml
    app:
        port: 1234 #port to launch
        pg:
            dialect: postgres
            database: serenity_discussions
            username: username
            password: password
            host: host
            port: 5432
        pgURL:
        query:
            pageSize: 20
            onlyRootMessages: false
```

For the database connection you can either use the pg object or the pgURL.  The pgURL is looked for first and will override the pg.

The default page size is set to 20 records in the `config/default.yaml`.

    query:
      pageSize: 20

By default `getAllByDiscussion`	 operation returns all messages in a discussion.

    query:
      onlyRootMessages: false

To return only root-level messages, please set `onlyRootMessages` options to true.