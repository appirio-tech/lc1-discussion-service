
## Implementation Details

The processing of fields parameter is done by analyzing the model's rawAttributes and associations carefully. The keys in the fields parameter are association names or rawAttributes names. 
For partial response, the first step is find an rawAttributes name in fields value, if found keep this value, if not, delete this value.

As for expand functionality, the first step is to find an association by fields value, then use the association metadata to fetch data. The model definition in the Sequelize module provides a detail of all associations.

There are three types of associations identified. For each type, the filter is constructed from the association metadata to fetch the correct data. This process continues on the result data recursively until either no more data or no more nesting fields parameter.

Since the expanding process relys on the association info, it's very important to set up the associations correctly in the model definition.

The implementation of fields parameter processing is done in lib/partialResponseHelper.js, so it can be easily added to other APIs. Parse the fields parameter first and process the resultData in the end.


#### parent-child association

This is when expanding `messages` from Discussion model. The Discussion model has a `HasMany` association to Message model through `messages`. In Sequelize module, this association is looked up from the model definition.

	association name: messages
	association type: HasMany
	association direction: Discussion to Message
	association object:
	      	{
		      	associationType: 'HasMany'
	   		}

And there is a ```discussionId``` column,in Message Model definition.

Retrieving job is doing in Message model and getAll
The filter expression to fetch this expanded data is

	where = {
		discussionId: entity.id
	}


#### child-parent association

This is when expanding `discussion` from Message model. The Message model has a `BelongsTo` association to Discussion model.

	association name: discussion
	association type: BelongsTo
	association direction: Message to Discussion
	association object:
	      	{
		      	associationType: 'BelongsTo',
		        identifier: 'discussionId'
	   		}

Retrieving job is doing in Discussion model and getOne
The filter expression:

	where = {
		id: entity['discussionId']
	}

#### self association

This is when expanding `messages` in the Message model. The Message model has a `HasMany` association to itself.

	association name: messages
	association type: HasMany
	association direction: Message to Message
	association object:
	      	{
		      	associationType: 'HasMany',
		      	source: Message,
		      	target: Message,
		        identifier: 'parentMessageId'
	   		}

The Retrieving job is doing in Child Message Model and getAll
The filter expression:

	where = {
		parentMessageId: entity['id']
	}

#### reverse-self association

This is when expanding `parentMessage` in the Message model. Since Message model has a `HasMany` association through `parentMessageId`, the expand key `parentMessage`+`Id` can be found from the identifer of this assoication.

	association name: messages
	association type: HasMany
	association direction: Message to Message
	association object:
	      	{
		      	associationType: 'HasMany',
		      	source: Message,
		      	target: Message,
		        identifier: 'parentMessageId'
	   		}

The identifier of above assoication is `parentMessageId`.

The Retrieving job is doing in Father Message Model and getOne
The filter expression:

	where = {
		id: entity['parentMessageId']
	}