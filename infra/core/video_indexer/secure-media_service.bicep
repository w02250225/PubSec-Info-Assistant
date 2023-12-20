param name string
param location string
param tags object = {}
param subnetResourceId string
param dnsZoneName string
param storageAccountID string 

resource mediaService 'Microsoft.Media/mediaservices@2023-01-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    publicNetworkAccess: 'Disabled'
    storageAccounts: [
      {
        id: storageAccountID
        identity: {
          useSystemAssignedIdentity: true
        }
        type: 'Primary'
      }
    ]
  }
}

module privateEndpoint '../network/secure-private_endpoint.bicep' = {
  name: 'private-endpoint-${name}'
  params: {
    name: name
    location: location
    tags: tags
    serviceResourceId: mediaService.id
    subnetResourceId: subnetResourceId
    groupId: 'streamingendpoint'
  }
}

module self '../dns/secure-private_dns_zone-record.bicep' = {
  name: 'a-record-${name}-self'
  params: {
    hostname: name
    groupId: privateEndpoint.outputs.groupId
    privateEndpointName: privateEndpoint.outputs.name
    privateDnsZoneName: dnsZoneName
    ipAddress: privateEndpoint.outputs.ipAddress
  }
}

output privateEndpointId string = privateEndpoint.outputs.id
output privateEndpointName string = privateEndpoint.outputs.name
output privateEndpointIp string = privateEndpoint.outputs.ipAddress
