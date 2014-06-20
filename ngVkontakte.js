
angular.module('ngVkontakte', [])
        .provider('$vkontakte', function() {
            
            var config = {
                permissions: '',
                appId: null,
                customInit: {}
            };


            this.setAppId = function(appId) {
                config.appId = appId;
                return this;
            };
            this.getAppId = function() {
                return config.appId;
            };
            this.setPermissions = function(permissions) {
                config.permissions = permissions;
                return this;
            };
            this.getPermissions = function() {
                return config.permissions;
            };
            this.setCustomInit = function(customInit) {
                config.customInit = customInit;
                return this;
            };
            this.getCustomInit = function() {
                return config.customInit;
            };

            this.$get = ['$q', '$rootScope', '$window', function($q, $rootScope, $window) {
                    var $vkontakte = $q.defer();
                    $vkontakte.config = function(property) {
                        return config[property];
                    };

                    //Initialization
                    $vkontakte.init = function() {
                        if ($vkontakte.config('appId') == null)
                            throw "$vkontakteProvider: `appId` cannot be null";

                        $window.VK.init(
                                angular.extend({
                                    apiId: $vkontakte.config('appId'),
                                }, $vkontakte.config("customInit"))

                                );
                        $rootScope.$broadcast("vk.load", $window.VK);

                    };

                    $rootScope.$on("vk.load", function(e, VK) {
                        $vkontakte.resolve(VK);

                        //Define action events
                        angular.forEach([
                            'auth.login', 'auth.logout',
                            'auth.sessionChange', 'auth.statusChange'
                        ], function(event) {
                            VK.Observer.subscribe(event, function(response) {
                                console.log('VK.Observer:' + event, response);
//                                $vkontakte._lastAuthResponse = response;
                                $rootScope.$broadcast("vk." + event, response, VK);
                                if (!$rootScope.$$phase)
                                    $rootScope.$apply();
                            });
                        });

                        // Make sure 'vk.auth.authResponseChange' fires even if the user is not logged in.
                        $vkontakte.getLoginStatus();
                    });

                    /**
                     * Internal cache
                     */
                    $vkontakte._cache = {};
                    $vkontakte.setCache = function(attr, val) {
                        $vkontakte._cache[attr] = val;
                    };
                    $vkontakte.getCache = function(attr) {
                        if (angular.isUndefined($vkontakte._cache[attr]))
                            return false;
                        return $vkontakte._cache[attr];
                    };
                    $vkontakte.clearCache = function() {
                        $vkontakte._cache = {};
                    };

                    /**
                     * Authentication
                     */

                    var firstAuthResp = $q.defer();
                    var firstAuthRespReceived = false;
                    function resolveFirstAuthResp(VK) {
                        if (!firstAuthRespReceived) {
                            firstAuthRespReceived = true;
                            firstAuthResp.resolve(VK);
                        }
                    }

                    $vkontakte.setCache("connected", null);
                    $vkontakte.isConnected = function() {
                        return $vkontakte.getCache("connected");
                    };
                    $rootScope.$on("vk.auth.statusChange", function(event, response, VK) {
                        $vkontakte.clearCache();

                        if (response.status == "connected") {
                            $vkontakte.setCache("connected", true);
                        } else {
                            $vkontakte.setCache("connected", false);
                        }
                        resolveFirstAuthResp(VK);
                    });

                    $vkontakte.getLoginStatus = function(force) {
                        var deferred = $q.defer();

                        return $vkontakte.promise.then(function(VK) {
                            VK.Auth.getLoginStatus(function(response) {
//                                console.log(response);
                                if (response.error)
                                    deferred.reject(response.error);
                                else {
                                    deferred.resolve(response);
                                    if ($vkontakte.isConnected() == null) {
                                        $rootScope.$broadcast("vk.auth.statusChange", response, VK);
                                    }
                                }
                                if (!$rootScope.$$phase)
                                    $rootScope.$apply();
                            }, force);
                            return deferred.promise;
                        });
                    };
                    $vkontakte.login = function(permissions) {
                        if (permissions == undefined)
                            var permissions = $vkontakte.config("permissions");
                        var deferred = $q.defer();

                        return $vkontakte.promise.then(function(VK) {
                            VK.Auth.login(function(response) {
                                console.log(response);
                                if (response.error)
                                    deferred.reject(response.error);
                                else
                                    deferred.resolve(response);
                                if (!$rootScope.$$phase)
                                    $rootScope.$apply();
                            }, permissions);
                            return deferred.promise;
                        });
                    };
                    $vkontakte.logout = function() {
                        var deferred = $q.defer();

                        return $vkontakte.promise.then(function(VK) {
                            VK.Auth.logout(function(response) {
                                console.log(response);
                                if (response.error)
                                    deferred.reject(response.error);
                                else
                                    deferred.resolve(response);
                                if (!$rootScope.$$phase)
                                    $rootScope.$apply();
                            });
                            return deferred.promise;
                        });
                    };
                    
                    //Need test
                    $vkontakte.ui = function(params) {
                        var deferred = $q.defer();

                        return $vkontakte.promise.then(function(VK) {
                            VK.ui(params, function(response) {
                                if (response && response.post_id)
                                    deferred.resolve(response);
                                else if (response && response.error)
                                    deferred.reject(response.error);
                                else
                                    deferred.reject(null);
                                if (!$rootScope.$$phase)
                                    $rootScope.$apply();
                            });
                            return deferred.promise;
                        });
                    };
                    
                    $vkontakte.api = function() {
                        var deferred = $q.defer();
                        var args = arguments;
                        args[args.length++] = function(response) {
                            if (response.response.error)
                                deferred.reject(response.response.error);
                            else
                                deferred.resolve(response.response);
                            if (!$rootScope.$$phase)
                                $rootScope.$apply();
                        };

                        return firstAuthResp.promise.then(function(VK) {
                            VK.api.apply(VK, args);

                            return deferred.promise;
                        });
                    };

                    /**
                     * API cached request - cached request api with promise
                     *
                     * @param path
                     * @returns $q.defer.promise
                     */
                    $vkontakte.cachedApi = function() {
                        if (typeof arguments[0] !== 'string')
                            throw "$vkontakte.cacheApi can works only with graph requests!";

                        var promise = $vkontakte.getCache(arguments[0]);
                        if (promise)
                            return promise;

                        var result = $vkontakte.api.apply($vkontakte, arguments);
                        $vkontakte.setCache(arguments[0], result);

                        return result;
                    };

                    return $vkontakte;
                }];
        })
        .run(['$rootScope', '$window', '$vkontakte', function($rootScope, $window, $vkontakte) {
                $window.vkAsyncInit = function() {
                    $vkontakte.init();
                    if (!$rootScope.$$phase)
                        $rootScope.$apply();
                };
            }])
        ;