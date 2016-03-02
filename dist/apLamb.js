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

    angular
        .module("apLamb")
        .run(
        ["$q", "$rootScope", "lambConfigService",
        function($q, $rootScope, lambConfigService) {
            if (! angular.isPromise) {
                angular.isPromise = function(obj) {
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

                $rootScope.$on(LAMB_BUS, function (event, message) {
                    var callbackCount = 0;
                    var pubTopic = new TopicMatcher(message.publisher.topic);

                    angular.forEach(subscribers, function (subscriber) {
                        var subTopic;

                        if (subscriber.subscriberId !== message.publisher.publisherId) {
                            subTopic = new TopicMatcher(subscriber.topic);

                            if (TopicMatcher.isMatch(pubTopic, subTopic)) {
                                if (lambConfigService.getLogLevel() === lambConfigService.LogLevelEnum.VERBOSE) {
                                    $log.debug(
                                        "lamb: " +
                                        subscriber.subscriberId +
                                        " subscriber called for '" + subscriber.topic + "'"
                                    );
                                }

                                subscriber.callbackFn(message.data, new MessageInfo(
                                    message.publisher,
                                    subscriber,
                                    (pubTopic.hasWild() && !subTopic.hasWild())
                                        ? TopicMatcher.result.topic1.captured
                                        : TopicMatcher.result.topic2.captured,
                                    message.data));

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
       }
     */
    function Message(publisher, data) {
        this.data = data;
        this.publisher = publisher;
    }
    
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
           topic
       }
     */
    function Publisher(publisherId, topic) {
        this.publisherId = publisherId;
        this.topic = topic;
    }

    /*
       Subscriber: {
           callbackFn: Method to call when a matching message is received
           subscriberId: The identifier of the subscriber
           topic
       }
     */
    function Subscriber(topic, subscriberId, callbackFn) {
        this.callbackFn = callbackFn;
        this.subscriberId = subscriberId;
        this.topic = topic;
    }

    /*
        TopicMatcher
     */
    function TopicMatcher(topicString) {
        this.captured = [];
        this.current = topicString.split('.');
        this.topicString = topicString;
    }

    TopicMatcher.prototype = {
        advance: function(capture, size) {
            var i;

            if (!this.atEnd()) {
                this.captured.push(capture);
                for (i = 0; i < (size || 1); ++i) {
                    this.current.shift();
                }
            }
        },

        clone: function() {
            var result = new TopicMatcher(this.topicString);
            result.captured = this.captured.slice();
            result.current = this.current.slice();
            return result;
        },

        atEnd: function() {
            return (this.current.length === 0);
        },

        currentItem: function(size) {
            var i;
            var result = "";

            size = size || 1;
            if (this.current.length < size)
                return null;

            for (i = 0; i < size; ++i) {
                if (result.length > 0)
                    result += ".";
                result += this.current[i];
            }

            return result;
        },

        hasWild: function() {
          return (this.topicString.indexOf("*") !== -1);
        },

        isCurrentWild: function() {
            return (!this.atEnd() && this.current[0] === "*");
        },

        wildCandidateCount: function() {
            var i;
            var result = 0;

            for (i = 0; i < this.current.length; ++i) {
                if (i > 0 && this.current[i] === "*")
                    return result;
                ++result;
            }

            return result;
        }
    };

    TopicMatcher.isMatch = function(topic1, topic2) {
        var item1;
        var item2;
        var topic1Copy;
        var topic2Copy;

        // If neither topic string contains wildcards, they must match exactly.
        if (!(topic1.hasWild || topic2.hasWild))
            return (topic1.topicString === topic2.topicString);

        // If both sides are at the end (and we haven't failed thus far), we have succeeded.
        if (topic1.atEnd() && topic2.atEnd()) {
            TopicMatcher.result = {
                topic1: topic1,
                topic2: topic2
            };
            return true;
        }

        // If the current part of the topicString is not wild (both sides), then they must match.
        // Then, the remainder must match.
        if (!(topic1.isCurrentWild() || topic2.isCurrentWild())) {
            item1 = topic1.currentItem();
            item2 = topic2.currentItem();
            if (item1 !== item2)
                return false;

            topic1Copy = topic1.clone();
            topic2Copy = topic2.clone();
            topic1Copy.advance(item2);
            topic2Copy.advance(item1);
            return TopicMatcher.isMatch(topic1Copy, topic2Copy);
        }

        // One (or both) sides have wildcards.
        // Use wildMatch()
        return  (topic1.isCurrentWild() && TopicMatcher.wildMatch(topic1, topic2, false)) ||
                (topic2.isCurrentWild() && TopicMatcher.wildMatch(topic2, topic1, true));
    };

    TopicMatcher.wildMatch = function(topic1, topic2, reverse) {
        var i;
        var item1;
        var item2;
        var topic1Copy;
        var topic2Copy;

        if (!topic1.isCurrentWild())
            throw new Error("Internal error: Topic.wildMatch must have wild LHS");

        // Wildcards in topic strings mean match 1 or more topic parts.
        // Using the LHS as the pattern, try to match the RHS by consuming non-wildcard parts.
        // (Leading wildcards in both sides match.)
        for (i = 1; i <= topic2.wildCandidateCount(); ++i) {
            topic1Copy = topic1.clone();
            topic2Copy = topic2.clone();

            item1 = topic1Copy.currentItem();
            item2 = topic2Copy.currentItem(i);

            topic1Copy.advance(item2);
            topic2Copy.advance(item1, i);

            if (!reverse && TopicMatcher.isMatch(topic1Copy, topic2Copy))
                return true;

            if (reverse && TopicMatcher.isMatch(topic2Copy, topic1Copy))
                return true;
        }

        return false;
    }
})();