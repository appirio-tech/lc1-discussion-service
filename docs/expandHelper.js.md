### Library position

lib/expandHelper.js

### Usage

1. In app.js, add the expandHelper.parseExpandParam middleware to the express app. The middleware should be added before the a127 middlewares, otherwise the expand parameter in the req.query object will cause an error in controllerHelper.js. 
2. Replace the ```next()``` function call with:```expandHelper.expandObject(model, req, next);``` in each get call function in ```controllerHelper.js``` or ```api/controllers/messages.js```

### Accepted Expand Pramater Format and Validation
Expand parameter is an array. Its item formatted in string, and their structure is as following:

	A.B...B


1. The structure starting with an "A" and followed by any amount of "B".
	
	**Note:**
	1. Cannot end up with a '.'
		
		For example:
		
			"messages." is not accepted.
2. "A" must be plural for a Model. Like messages stands for Message.

	**Note:**
	1. This model must be in sequelize datasource. Otherwise it will not be accepted.
		
		For example:
		
			"messages" is accepted.
			"books" is not.
	
3. "B" could be one of the three type:
	1. Plural for a Model. Like messages stands for Message.
	2. A term. Like 'all'. Currently, 'all' is the only accepted term.
	3. A foreignkey name. Like discussion stands for discussionId,
		parentMessage stands for parentMessageId. The foreignkey name could be singular for a Model or just a column name without 'Id' suffix.
   
   **Note:**
   		
   	1. If "B" is in type 1, its previous variable must stand for a model and this model must have an association which is hasMany "B".
   	
   		For example:
   			
   			"messages.messages". This parameter can be abstract to:
   			A: messages (Model)
   			B: messages (Model)
   			("A" do hasMany "B". This expand parameter accepted.)
   			
   			"messages.messages". This parameter can be abstract to:
   			A: messages (Model)
   			B: messages (Model)
   			B: discussions (Model)
   			(The Message Model represented by the second "B" does not hasMany Discussion Model represented by the third "B". This parameter is not accepted.)
   			
   	2. If "B" is in type 2, it must be in second position. "A" is in one, then is this "B".
   	
   		For example:
   		
   			"messages.all". This parameter can be abstract to:
   			A: messages (Model)
   			B: all (Term)
   			Accepted.
   			
   			"messages.messages.all". This parameter can be abstract to:
   			A: messages (Model)
   			B: messages (Model)
   			B: all (Term)
   			Not Accepted.
   	3. If "B" is in type 3, its previous variable must stand for a model and this model must have an foreignkey whose value is this "B". Also, this "B" must be in second position.
   	
   		For example:
   			
   			"messages.discussion" This parameter can be abstract to:
   			A: messages (Model)
   			B: discussion (foreignkey: discussionId)
   			("A" do have a foreignkey which is discussionId. Accepted.)
   			
   			"messages.sender" This parameter can be abstract to:
   			A: messages (Model)
   			B: sender (foreignkey: senderId)
   			("A" does not have a foreignkey which is senderId. Not Accepted.)
   			
_Above is the format validation. Then comes the validation on the expand depth._

Situation like: ```http://{{url}}?expand[]=messages&&expand[]=messages.messages``` may cause problem about the conflict of different expand depth. Expand only the first level or even the second level ?

The validation will check the depth of each expand parameter but only the parameter whose variables is the same model or contains a 'all' term. Such as: messages.messages.messages or messages.all
	
For example:
	
	expand[]=messages&&expand[]=messages.messages
	The expand depth of Message model in first parameter is 1, in second parameter is 2. This is not accepted.
	
	expand[]=messages.messages&&expand[]=messages.discussion
	The expand depth of Message model in first parameter is 2. The second expan parameter will not be considered in the depth check.
	
	expand[]=messages.messages&&expand[]=senders.senders.senders
	The expand depth of Message model is 2. The expand depth of Sender model is 3. They are calculated respectively. Although the sender model is not exist in current challenge, this is a reuseable pattern, it can handle this if it really exist.
	
	expand[]=messages.all
	The expand depth of Message model is infinity.
	