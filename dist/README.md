# Lamb API Documentation
Lamb: "Little Angular Message Bus""

The module's name is "apLamb"

## Configuration

Lamb supports console logging.  To use it create a *service* named ```LambConfig``` that contains a configuration object:

```javascript
{
    logLevel: (string)
}
```

Legal log levels are ```"None"```, ```"Normal"```, or ```"Verbose"```

There is also a configuration service ```LambConfigService``` that allows for programmatic setting of the log level.  The definition of the configuration service is:

```javacript
{
    LAMB_CONFIG_NAME: (string)
    LogLevelEnum: {
        NONE: "None",
        NORMAL: "Normal",
        VERBOSE: "Verbose"
    }

    getLogLevel: function() { returns (string); },
    setLogLevel: function(string) {}
}
```


## Construction

```javascript
var bus;
bus = new Lamb(clientName, scope)  // or
bus = Lamb(clientName, scope)
```

The Lamb service is a constructor function that must be called to use the bus.  It can be constructed by either using the ```new``` operator, or calling it as a function.

* clientName:   (Required), The name of the object that will be publishing or subscribing.  This name will be displayed in log messages.  Note that depending on the scope argument to the constructor, Lamb may augment the name with the scope ID.  This allows the developer to discriminate between multiple instances of the same Lamb client.

* scope:        (Optional). If a scope is not provided, Lamb will construct a new isolated scope and "assign" it to the client.  In this scenario, the scope will **not** be automatically destroyed, so this pattern is recommended for clients that will call ```destroy()```.  If a non-```$rootScope``` is supplied, Lamb will augment the clientName with the scope's ID during logging.  When AngularJS destroys the scope, Lamb will unregister the client from the bus.  This is the pattern that is recommended for non-service recipes.  If a ```$rootScope``` is provided, Lamb assumes that the client is a singleton service.  The name will not be augmented, and the client will never be unregistered from the bus.

After the "bus" object is created, it can be utilized via the API methods that follow.

## messages
Messages have two parts: a topic, and the data.

#### data
The data can be any Javascript object.  This includes simple types.

#### topic
The topic is a period-delimitted string.  It is suggested that topics mimic the hierarchical structure of the application.  For example, "checkout.shopping-cart.item.changed".

You may choose to have an ID as the last part of a topic.  For example, "authentication.user.change.123".  This allows a subscriber to easily handle an event for a particular object or a class of objects using wildcards.

### wildcards
If an asterisk is used within a subscription topic, the asterisk matches one (or more) topic groups.  For example, given the (published) topic of "authentication.user.change.123", then:

* "authentication.user.change.*" matches changes to all user objects.
* "authentication.user.*.123" matches both "change" and "delete" topics for user 123.
* "authentication.user.\*" (or "authentication".user.\*.*") matches all topics for all users.
* "authentication.*" matches all topics for all authentication objects.

Wildcards can also be used with publishing.  For example, if a subscriber registers for the "authentication.user.change.123" topic, then:

* "authentication.user.change.*" will match.
* "authentication.user.*.123" will match.
* "\*.change.*" will match.
* "authentication.user.create.*" will not match.

Note that using wildcards for **both** publishing and subscribing can have suprising results!


## dispose
This unregisters the bus.  The bus will no longer receive messages.  The bus also **cannot** be used to publish messages.  A new bus must be constructed, and the registrations reissued to handle subsequent messages.  If the bus is constructed by supplying the scope associated with the calling recipe (not a service), then calling this method is not required; when the scope is destroyed, Lamb will unregister the bus.

## publish

```javascript
publish(topic, data)    // no return
```
Puts the data on the message bus for the given topic.  All subscribers that have a matching topic will receive the message.

## subscribe

```javascript
subscribe(topic, callbackFn)    // no return
```
Registers for a topic on the bus.  When a message is published whose topic matches the subscription topic the callback function will be called.  The signature of the callback function is:

```javascript
callbackFn(data, messageInfo)
```
The data parameter is the exact object that is passed into ```publish()```.  MessageInfo is an object that provides extended information regarding the message:

```javascript
messageInfo: {
    data: (object)
    publisherId: (string)
    publisherTopic: (string)
    subscriberId: (string)
    subscriberTopic: (string)
    topicMatches: []    // array of strings
}
```

The publisher and the subscriber topics are the exact strings used in the ```publish()``` and ```subscribe()``` calls, including wildcards.
The topicMatches array is an array of subtopics that was used to match the publisher topic to the subscriber topic.  For example, if the publisher topic is "authentication.user.change.123", and the subscriber topic is "authentication.user.change.*", then topic matches would be ```["authentication", "user", "change", "123"]```.

The messageInfo object contains a helper function for retrieving subtopics:

```javascript
messageInfo.getSubtopic(index, defaultValue)
```

* index is the zero-based position within topicMatches.
* defaultValue (optional) is the value to return if there is no subtopic at that position.  This can occur when a wildcard matches a number of subtopics at the tail end of the topic.

## unsubscribe

```javascript
unsubscribe(topic)  // no return
```

Unsubscribes the client from the bus for zero or more topics.

* If a topic is provided, and the full string of the topic does not match the full string topic of a previous registration, then nothing happens.
* If a topic is provided, and the full string of the top matches exactly a topic string used in registration, then that topic is successfully unregistered.  Subsequent publishing will **never** execute the callback function of the client provided in the original registration.
* If no topic is provided (or null), then the client will be unsubscribed from all topics.