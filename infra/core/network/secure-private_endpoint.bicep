param serviceName string
param location string
param serviceResourceId string
param subnetResourceId string
param groupId string
param tags object = {}

resource privateEndpoint 'Microsoft.Network/privateEndpoints@2021-02-01' = {
  name: '${serviceName}-private-endpoint'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: subnetResourceId
    }
    privateLinkServiceConnections: [
      {
        name: '${serviceName}-private-link-service-connection'
        properties: {
          privateLinkServiceId: serviceResourceId
          groupIds: [
            groupId
          ]
        }
      }
    ]
  }
}

module networkInterface 'secure-network_interface.bicep' = {
  name: '${serviceName}-network-interface'
  params: {
    name: last(split(privateEndpoint.properties.networkInterfaces[0].id, '/'))
  }
}

output id string = privateEndpoint.id
output name string = privateEndpoint.name
output ipAddress string = networkInterface.outputs.ipAddress
