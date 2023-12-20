param location string
param vnetName string
param tags object = {}
param networkSecurityGroupId string

param vnetIpAddressCIDR string
param snetPublicAccessCIDR string
param snetAzureMonitorCIDR string
param snetApiManagementCIDR string
param snetStorageAccountCIDR string
param snetCosmosDbCIDR string
param snetAzureAiCIDR string
param snetKeyVaultCIDR string
param snetAppInboundCIDR string
param snetAppOutboundCIDR string 
param snetFunctionInboundCIDR string
param snetFunctionOutboundCIDR string
param snetEnrichmentInboundCIDR string
param snetEnrichmentOutboundCIDR string

resource vnet 'Microsoft.Network/virtualNetworks@2023-04-01' = {
  name: vnetName
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [
        vnetIpAddressCIDR
      ]
    }
    subnets: [
      {
        name: 'publicAccess'
        properties: {
          addressPrefix: snetPublicAccessCIDR
          serviceEndpoints: [
          ]
        }
      }
      {
        name: 'azureMonitor'
        properties: {
          addressPrefix: snetAzureMonitorCIDR
          serviceEndpoints: [
          ]
          delegations: [
          ]
          networkSecurityGroup: {
            id: networkSecurityGroupId
          }
        }
      }
      {
        name: 'apiManagement'
        properties: {
          addressPrefix: snetApiManagementCIDR
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
        name: 'storageAccount'
        properties: {
          addressPrefix: snetStorageAccountCIDR
          serviceEndpoints: [
          ]
          networkSecurityGroup: {
            id: networkSecurityGroupId
          }
        }
      }
      {
        name: 'cosmosDb'
        properties: {
          addressPrefix: snetCosmosDbCIDR
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
          addressPrefix: snetAzureAiCIDR
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
          addressPrefix: snetKeyVaultCIDR
          serviceEndpoints: [
          ]
          networkSecurityGroup: {
            id: networkSecurityGroupId
          }
        }
      }
      {
        name: 'appInbound'
        properties: {
          addressPrefix: snetAppInboundCIDR
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
          addressPrefix: snetAppOutboundCIDR
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
        name: 'functionInbound'
        properties: {
          addressPrefix: snetFunctionInboundCIDR
          serviceEndpoints: [
          ]
          networkSecurityGroup: {
            id: networkSecurityGroupId
          }
        }
      }
      {
        name: 'functionOutbound'
        properties: {
          addressPrefix: snetFunctionOutboundCIDR
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
        name: 'enrichmentInbound'
        properties: {
          addressPrefix: snetEnrichmentInboundCIDR
          serviceEndpoints: [
          ]
          networkSecurityGroup: {
            id: networkSecurityGroupId
          }
        }
      }
      {
        name: 'enrichmentOutbound'
        properties: {
          addressPrefix: snetEnrichmentOutboundCIDR
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
    ]
  }
}

output name string = vnetName
output id string = vnet.id
output subnetIdPublicAccess string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'publicAccess')
output subnetIdApiManagement string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'apiManagement')
output subnetIdAzureMonitor string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'azureMonitor')

output subnetIdStorageAccount string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'storageAccount')
output subnetIdCosmosDb string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'cosmosDb')
output subnetIdAzureAi string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'azureAi')
output subnetIdKeyVault string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'keyVault')

output subnetIdAppInbound string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'appInbound')
output subnetIdAppOutbound string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'appOutbound')

output subnetIdFunctionInbound string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'functionInbound')
output subnetIdFunctionOutbound string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'functionOutbound')

output subnetIdEnrichmentInbound string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'enrichmentInbound')
output subnetIdEnrichmentOutbound string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'enrichmentOutbound')



