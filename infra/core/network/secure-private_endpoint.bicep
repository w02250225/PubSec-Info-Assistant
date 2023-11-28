param name string
param location string
param serviceResourceId string
param subnetResourceId string
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
  name: '${name}-network-interface'
  params: {
    name: last(split(privateEndpoint.properties.networkInterfaces[0].id, '/'))
  }
}

output id string = privateEndpoint.id
output name string = privateEndpoint.name
output groupId string = groupId
output ipAddress string = networkInterface.outputs.ipAddress
output inAddress2 string = networkInterface.outputs.ipAddress2
