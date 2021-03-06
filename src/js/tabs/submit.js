var util = require('util');
var Tab = require('../client/tab').Tab;
var fs = require('fs');

var SubmitTab = function ()
{
  Tab.call(this);
};

util.inherits(SubmitTab, Tab);

SubmitTab.prototype.tabName = 'submit';
SubmitTab.prototype.mainMenu = 'coldwallet';

SubmitTab.prototype.generateHtml = function ()
{
  return require('../../templates/tabs/tx.jade')();
};

SubmitTab.prototype.angular = function (module)
{
  module.controller('SubmitCtrl', ['$scope', '$location', 'rpFileDialog', 'rpNW', 'rpNetwork',
    function ($scope, $location, fileDialog, rpNW, $net)
    {
      $net.connect();

      $scope.txFiles = [];

      // User drops files on transaction files dropzone
      $scope.initDropzone = function() {
        rpNW.dnd("txDropZone", {
          onDrop: function(e) {
            $scope.$apply(function() {
              for (var i = 0; i < e.dataTransfer.files.length; ++i) {
                $scope.txFiles[i] = e.dataTransfer.files[i].path;
              }
            });
          }
        });
      };

      // User clicks on "Add transaction files"
      $scope.fileInputClick = function(){
        // Call the nw.js file dialog
        fileDialog.openFile(function(evt) {
          $scope.$apply(function() {
            // Update the file list
            // TODO list should be sorted by sequence number ASC
            $scope.txFiles = $scope.txFiles.concat(evt.split(';'));
          });
        }, true);
      };

      // User clicks the submit button
      $scope.submit = function() {
        $scope.loading = true;

        // Child scopes listen to this event to individually submit transactions
        $scope.$broadcast('submit');
      };

      var i = 0;
      // Listening for child scope transaction submission results
      $scope.$on('submitted', function(){
        i++;

        if ($scope.txFiles.length <= i) {
          $scope.loading = false;
        }
      })

      $scope.gotoLogin = function() {
        $location.path('/login');
      };
    }
  ]);

  // Individual transaction row controller
  module.controller('TxRowCtrl', ['$scope', 'rpNetwork',
    function ($scope, network) {
      // Remove the transaction from the list
      $scope.remove = function(){
        $scope.txFiles.splice($scope.index,1);
      };

      // Parent broadcasts the submit event
      $scope.$on('submit', function() {
        // Don't submit it more then once
        if ($scope.state == 'done') {
          $scope.$emit('submitted');
          return;
        }

        // Show loading...
        $scope.state = 'pending';

        // Get the signedTransaction
        fs.readFile($scope.txFile, 'utf8', function(err, data){
          if (err) {
            console.log('err',err);
            return;
          }
          // Transaction will either be a JSON transaction or the signed
          // blob only, in which case there will not be a tx_blob value
          var txBlob;
          try {
            var transaction = JSON.parse(data);
            txBlob = transaction.tx_blob;
          } catch(e) {
            txBlob = data;
          }

          // TODO validate blob
          // Submit the transaction to the network
          var request = new ripple.Request(network.remote, 'submit');
          request.message.tx_blob = txBlob;
          request.callback(function(err, response){
            $scope.$apply(function(){
              if (err) {
                console.log('err', err);
                $scope.state = 'error';
                return;
              }

              $scope.state = 'done';
              $scope.result = response.engine_result;

              // Tell the parent about the completion
              $scope.$emit('submitted');
            })
          });
          request.request();
        });
      })
    }
  ]);
};

module.exports = SubmitTab;
