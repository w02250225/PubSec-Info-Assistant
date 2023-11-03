param location string
param vnetName string
param networkSecurityGroupId string
param tags object = {}

resource vnet 'Microsoft.Network/virtualNetworks@2023-04-01' = {
  name: vnetName
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.0.0.0/24'
      ]
    }
    subnets: [
      {
        name: 'apiManagement'
        properties: {
          addressPrefix: '10.0.0.0/27'
          serviceEndpoints: [
            {
              service: 'Microsoft.Storage'
            }
            {
              service: 'Microsoft.Sql'
            }
            {
              service: 'Microsoft.EventHub'
            }
            {
              service: 'Microsoft.ServiceBus'
            }
            {
              service: 'Microsoft.Web'
            }
          ]
          networkSecurityGroup: {
            id: networkSecurityGroupId
          }
        }
      }
      {
        name: 'appInbound'
        properties: {
          addressPrefix: '10.0.0.32/28'
          serviceEndpoints: []
          delegations: []
          networkSecurityGroup: {
            id: networkSecurityGroupId
          }
        }
      }
      {
        name: 'appOutbound'
        properties: {
          addressPrefix: '10.0.0.48/28'
          serviceEndpoints: [
            {
              service: 'Microsoft.storage'
              locations: [
                location
              ]
            }
          ]
          delegations: [
            {
              name: 'Microsoft.Web/serverfarms'
              properties: {
                serviceName: 'Microsoft.Web/serverfarms'
              }
            }
          ]
          networkSecurityGroup: {
            id: networkSecurityGroupId
          }
        }
      }
      {
        name: 'storageAccount'
        properties: {
          addressPrefix: '10.0.0.64/27'
          serviceEndpoints: [
          ]
          networkSecurityGroup: {
            id: networkSecurityGroupId
          }
        }
      }
      {
        name: 'publicAccess'
        properties: {
          addressPrefix: '10.0.0.96/27'
          serviceEndpoints: [
          ]
        }
      }
      {
        name: 'cosmosDb'
        properties: {
          addressPrefix: '10.0.0.128/27'
          serviceEndpoints: [
          ]
          networkSecurityGroup: {
            id: networkSecurityGroupId
          }
        }
      }
      {
        name: 'azureAi'
        properties: {
          addressPrefix: '10.0.0.160/27'
          serviceEndpoints: [
          ]
          networkSecurityGroup: {
            id: networkSecurityGroupId
          }
        }
      }
      {
        name: 'keyVault'
        properties: {
          addressPrefix: '10.0.0.192/27'
          serviceEndpoints: [
          ]
          networkSecurityGroup: {
            id: networkSecurityGroupId
          }
        }
      }
      {
        name: 'functionInbound'
        properties: {
          addressPrefix: '10.0.0.224/28'
          serviceEndpoints: [
          ]
          networkSecurityGroup: {
            id: networkSecurityGroupId
          }
        }
      }
    ]
  }
}

output name string = vnetName
output id string = vnet.id
output subnetIdApiManagement string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'apiManagement')
output subnetIdAppInbound string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'appInbound')
output subnetIdFunctionInbound string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'functionInbound')
output subnetIdAppOutbound string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'appOutbound')
output subnetIdStorageAccount string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'storageAccount')
output subnetIdAppGateway string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'appGateway')
output subnetIdCosmosDb string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'cosmosDb')
output subnetIdAzureAi string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'azureAi')
output subnetIdKeyVault string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'keyVault')
