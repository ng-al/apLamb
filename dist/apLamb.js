// Copyright (c) 2015, Alvin Pivowar
// All rights reserved.

(function() {
    "use strict";

    var LAMB_CONFIG_NAME = "lambConfig";

    var LogLevelEnum = {
        NONE: "None",
        NORMAL: "Normal",
        VERBOSE: "Verbose"
    };
    LogLevelEnum.all = [LogLevelEnum.NONE, LogLevelEnum.NORMAL, LogLevelEnum.VERBOSE];

    angular.module("apLamb", []);

    //noinspection JSUnusedLocalSymbols
    angular
        .module("apLamb")
        .run(
        ["$q", "$rootScope", "lambConfigService",
        function($q, $rootScope, lambConfigService) {
            if (! angular.isPromise) {
                angular.isPromise = function(obj) {
                    //noinspection JSUnusedLocalSymbols
                    return (obj && obj.then && String(obj.then) === String($q(function(accept, reject) {accept();}).then));
                }
            }

            if (! angular.isScope) {
                angular.isScope = function (obj) {
                    return (obj && obj.$digest && String(obj.$digest) === String($rootScope.$digest));
                }
            }
        }]);

    angular
        .module("apLamb")
        .factory("lambConfigService",
        ["$injector",
        function($injector) {
            var _currentLogLevel;
            var _socks = [];

            init();

            function getLogLevel() {
                return _currentLogLevel;
            }

            function getSocks() {
                return _socks;
            }

            function init() {
                var lambConfigService;
                _currentLogLevel = "None";

                if ($injector.has(LAMB_CONFIG_NAME)) {
                    lambConfigService = $injector.get(LAMB_CONFIG_NAME);
                    if (lambConfigService.logLevel)
                        setLogLevel(lambConfigService.logLevel);
                    _socks = lambConfigService.socks;
                }
            }

            function setLogLevel(logLevel) {
                var enumItem;
                var errorMessage;
                var i;
                var proposedLogLevel = logLevel ? logLevel.toLowerCase() : "";

                for (i = 0; i < LogLevelEnum.all.length; ++ i) {
                    enumItem = LogLevelEnum.all[i];
                    if (proposedLogLevel === enumItem.toLowerCase()) {
                        _currentLogLevel = enumItem;
                        return;
                    }
                }

                errorMessage = "Illegal " + LAMB_CONFIG_NAME + ".logLevel '" + logLevel + "' - Valid values are ";
                for (i = 0; i < LogLevelEnum.all.length; ++ i) {
                    if (i > 0) errorMessage += ((i < LogLevelEnum.all.length - 1) ? ", " : " and ");
                    errorMessage += "'" + LogLevelEnum.all[i] + "'";
                }

                throw new Error(errorMessage);
            }

            return {
                LAMB_CONFIG_NAME: LAMB_CONFIG_NAME,
                LogLevelEnum: LogLevelEnum,

                getLogLevel: getLogLevel,
                setLogLevel: setLogLevel,
                getSocks: getSocks
            };
        }]);

    //noinspection JSUnusedLocalSymbols
    function LambConfig(logLevel, socks) {
        this.logLevel = logLevel;   // default: "None"
        this.socks = socks;         // default: null, but default sock protocol, host, and port default to server that
                                    // hosted the index.html page.  The default channel is "BLEAT".
    }
})();
// Copyright (c) 2015, Alvin Pivowar
// All rights reserved.

(function () {
    "use strict";

    angular
        .module("apLamb")
        .factory("Lamb",
            ["$log", "$rootScope", "lambConfigService",
            function ($log, $rootScope, lambConfigService) {
                // Private Service Properties
                var subscribers = [];
                var LAMB_BUS = "$$LAMB$$";

                // Private Service Methods

                $rootScope.$on(LAMB_BUS, function (event, /*Message*/message) {
                    var callbackCount = 0;
                    var topicMatches;

                    angular.forEach(subscribers, function (subscriber) {
                        if (subscriber.subscriberId !== message.publisher.publisherId) {
                            topicMatches = message.getTopicMatches(message.publisher, subscriber);
                            if (topicMatches) {
                                if (lambConfigService.getLogLevel() === lambConfigService.LogLevelEnum.VERBOSE) {
                                    $log.debug(
                                        "lamb: " +
                                        subscriber.subscriberId +
                                        " subscriber called for '" + subscriber.topic + "'"
                                    );
                                }

                                subscriber.callbackFn(message.data, new MessageInfo(message.publisher, subscriber, topicMatches, message.data));
                                ++callbackCount;
                            }
                        }
                    });

                    if (lambConfigService.getLogLevel() === lambConfigService.LogLevelEnum.NORMAL) {
                        $log.debug(
                            "lamb: " +
                            "topic '" + message.publisher.topic + "', " +
                            "publisher '" + message.publisher.publisherId + "', " +
                            callbackCount + " subscribers"
                        );
                    }

                    if (callbackCount === 0 && lambConfigService.getLogLevel() === lambConfigService.LogLevelEnum.VERBOSE) {
                        $log.debug("lamb: no subscribers for '" + message.publisher.topic + "'");
                    }
                });

                function publishImp(message) {
                    if (lambConfigService.getLogLevel() === lambConfigService.LogLevelEnum.VERBOSE) {
                        $log.debug(
                            "lamb: " +
                            message.publisher.publisherId +
                            " publishes '" + message.publisher.topic + "'"
                        );
                        $log.debug("lamb data: " + JSON.stringify(message.data));
                    }

                    $rootScope.$broadcast(LAMB_BUS, message);
                }

                function subscribeImp(newSubscriber) {
                    var i;
                    var subscriber;

                    for (i = 0; i < subscribers.length; ++i) {
                        subscriber = subscribers[i];
                        if (subscriber.subscriberId === newSubscriber.subscriberId && subscriber.topic === newSubscriber.topic) {
                            return;
                        }
                    }

                    if (lambConfigService.getLogLevel() === lambConfigService.LogLevelEnum.VERBOSE) {
                        $log.info(
                            "lamb: " +
                            newSubscriber.subscriberId +
                            "subscribes to '" + newSubscriber.topic + "'"
                        );
                    }

                    subscribers.push(newSubscriber);
                }

                function unregisterImp(subscriberId) {
                    if (lambConfigService.getLogLevel() === lambConfigService.LogLevelEnum.VERBOSE) {
                        $log.info(
                            "lamb: " +
                            subscriberId +
                            " unsubscribes from all topics"
                        );
                    }

                    unsubscribeImp(null, subscriberId);
                }

                // If topic is null, all subscriptions for the subscriber will be removed.
                function unsubscribeImp(topic, subscriberId) {
                    var newSubscribers = [];

                    angular.forEach(subscribers, function (subscriber) {
                        if (subscriber.subscriberId != subscriberId ||
                            (subscriber.subscriberId === subscriberId && topic && topic !== subscriber.topic)) {
                            newSubscribers.push(subscriber);
                        }
                    });

                    if (lambConfigService.getLogLevel() === lambConfigService.LogLevelEnum.VERBOSE
                        && newSubscribers.length !== subscribers.length) {
                        $log.info(
                            "lamb: " +
                            subscriberId +
                            "unsubscribes '" + topic + "'"
                        );
                    }

                    subscribers = newSubscribers;
                }

                function Lamb(clientName, scope) {
                    // Constructor
                    if (!clientName) throw new Error("clientName cannot be null or empty.");
                    if (scope && !angular.isScope(scope)) throw new Error("2nd argument is not a scope.");

                    var that = (this instanceof Lamb) ? this : Object.create(Lamb.prototype);

                    // If a scope was not passed in, create a temporary scope to use the monotonically increasing $id.
                    var idScope = scope || $rootScope.$new(true);
                    var isChildScope = idScope.$parent;

                    // Public Lamb Properties
                    that.clientId = clientName + (isChildScope ? "(" + idScope.$id + ")" : "");

                    // Private Lamb Methods
                    if (scope && isChildScope) {
                        scope.$on("$destroy", function () {
                            that.dispose();
                        });
                    }

                    if (!idScope)
                        idScope.$destroy();

                    return that;
                }
                
                Lamb.prototype = {
                    dispose: function () {
                        if (this.clientId) {
                            unregisterImp(this.clientId);
                            this.clientId = null;
                        }
                    },
                    
                    publish: function (topic, data) {
                        var message;
                        var publisher;

                        if (this.clientId) {
                            if (!topic) throw new Error("topic cannot be null or empty");

                            publisher = new Publisher(this.clientId, topic);
                            message = new Message(publisher, data);
                            publishImp(message);
                        }
                    },
                    
                    subscribe: function (topic, callbackFn) {
                        var subscriber;
                        
                        if (this.clientId) {
                            if (!topic) throw new Error("topic cannot be null or empty");

                            subscriber = new Subscriber(topic, this.clientId, callbackFn);
                            subscribeImp(subscriber);
                        }
                    },
                    
                    unsubscribe: function (topic) {
                        if (this.clientId) {
                            if (!topic) throw new Error("topic cannot be null or empty");

                            unsubscribeImp(topic, this.clientId);
                        }
                    }
                };

                return Lamb;
            }]);

    /*
       Message: {
           data: Javascript object of the message contents
           publisher
           
           getTopicMatches(): Build an array of literals based on matching the message topic to the subscriber's pattern.
       }
     */
    function Message(publisher, data) {
        this.data = data;
        this.publisher = publisher;
    }
    
    Message.prototype.getTopicMatches = function (publisher, subscriber) {
        var i;
        var publisherSubtopic;
        var subscriberSubtopic;
        var topicLength;
        var topicMatches;

        function getSubtopic(subtopics, index) {
            if (index < subtopics.length) {
                return subtopics[index];
            } else if (subtopics[subtopics.length - 1] === "*") {
                return "*";
            } else {
                return undefined;
            }
        }

        function isMatch(subtopic1, subtopic2) {
            if (! (subtopic1 && subtopic2)) return false;
            if (subtopic1 === "*" || subtopic2 === "*") return true;
            return (subtopic1 === subtopic2);
        }

        topicLength = Math.max(publisher.subtopics.length, subscriber.subtopics.length);
        topicMatches = [];
        for (i = 0; i < topicLength; ++i) {
            publisherSubtopic = getSubtopic(publisher.subtopics, i);
            subscriberSubtopic = getSubtopic(subscriber.subtopics, i);

            if (!isMatch(publisherSubtopic, subscriberSubtopic)) return null;
            topicMatches.push((publisherSubtopic !== "*") ? publisherSubtopic : subscriberSubtopic);
        }

        return topicMatches;
    };

    /*
        MessageInfo: {
           data
           publisherId
           publisherTopic
           subscriberId
           subscriberTopic
           topicMatches
           
           getSubtopic(index, defaultValue)
       }
     */
    function MessageInfo(publisher, subscriber, topicMatches, data) {
        this.publisherId = publisher.publisherId;
        //noinspection JSUnusedGlobalSymbols
        this.publisherTopic = publisher.topic;
        this.subscriberId = subscriber.subscriberId;
        //noinspection JSUnusedGlobalSymbols
        this.subscriberTopic = subscriber.topic;
        this.topicMatches = topicMatches;
        this.data = data;
    }
    
    MessageInfo.prototype.getSubtopic = function (index, defaultValue) {
        return (this.topicMatches && this.topicMatches.length > index) ? this.topicMatches[index]: defaultValue;
    };

    /*
       Publisher: {
           publisherId
           subtopics:  An array of the parts of the topic (a.b.c => [a, b, c])
           topic
       }
     */
    function Publisher(publisherId, topic) {
        this.publisherId = publisherId;
        this.subtopics = topic.split('.');
        this.topic = topic;
    }

    /*
       Subscriber: {
           callbackFn: Method to call when a matching message is received
           subscriberId: The identifier of the subscriber
           subtopics:  An array of the parts of the topic (a.b.c => [a, b, c])
           topic
       }
     */
    function Subscriber(topic, subscriberId, callbackFn) {
        this.callbackFn = callbackFn;
        this.subscriberId = subscriberId;
        this.subtopics = topic.split('.');
        this.topic = topic;
    }
})();