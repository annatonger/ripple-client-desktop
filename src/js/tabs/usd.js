var util = require('util'),
    Tab = require('../client/tab').Tab;

var UsdTab = function ()
{
  Tab.call(this);
};

util.inherits(UsdTab, Tab);

UsdTab.prototype.tabName = 'usd';
UsdTab.prototype.mainMenu = 'fund';

UsdTab.prototype.angularDeps = Tab.prototype.angularDeps.concat(['qr']);

UsdTab.prototype.generateHtml = function ()
{
  return require('../../jade/tabs/usd.jade')();
};

UsdTab.prototype.angular = function (module)
{
  module.controller('UsdCtrl', ['$rootScope', 'rpId', 'rpAppManager', 'rpTracker', '$routeParams',
    function ($scope, $id, appManager, rpTracker, $routeParams)
    {
      $scope.usdAmount = 10;
      if (!$id.loginStatus) return $id.goId();

      $scope.fee = ($scope.usdAmount*.18) + 1;

      $scope.total = $scope.usdAmount + $scope.fee;

    }]);
};

module.exports = UsdTab;
