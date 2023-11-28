param name string
param location string
param serviceResourceId string
param subnetResourceId string
param privateDnsZoneResourceIdMonitor string
param privateDnsZoneResourceIdOpsInsightOms string
param privateDnsZoneResourceIdOpsInsightOds string
param privateDnsZoneResourceIdAutomation string
param privateDnsZoneResourceIdBlob string
param groupId string
param tags object = {}

resource privateEndpoint 'Microsoft.Network/privateEndpoints@2021-02-01' = {
  name: '${name}-private-endpoint'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: subnetResourceId
    }
    privateLinkServiceConnections: [
      {
        name: '${name}-private-link-service-connection'
        properties: {
          privateLinkServiceId: serviceResourceId //Private link scope Resource id
          groupIds: [
            groupId
          ]
        }
      }
    ]
  }
}

resource privateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2022-05-01' = {
  parent: privateEndpoint
  name: '${groupId}PrivateDnsZoneGroup'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'privatelink-monitor-azure-com'
        properties: {
          privateDnsZoneId: privateDnsZoneResourceIdMonitor
        }
      }
      {
        name: 'privatelink-oms-opinsights-azure-com'
        properties: {
          privateDnsZoneId: privateDnsZoneResourceIdOpsInsightOms
        }
      }
      {
        name: 'privatelink-ods-opinsights-azure-com'
        properties: {
          privateDnsZoneId: privateDnsZoneResourceIdOpsInsightOds
        }
      }
      {
        name: 'privatelink-agentsvc-azure-automation-net'
        properties: {
          privateDnsZoneId: privateDnsZoneResourceIdAutomation
        }
      }
      {
        name: 'privatelink-blob-core-windows-net'
        properties: {
          privateDnsZoneId: privateDnsZoneResourceIdBlob
        }
      }
    ]
  }
}

module networkInterface 'secure-network_interface.bicep' = {
  name: '${name}-network-interface'
  params: {
    name: last(split(privateEndpoint.properties.networkInterfaces[0].id, '/'))
  }
}

output id string = privateEndpoint.id
output name string = privateEndpoint.name
output ipAddress string = networkInterface.outputs.ipAddress
