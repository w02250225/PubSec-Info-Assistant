param name string
param location string
param tags object = {}
param subnetResourceId string
param dnsZoneName string

var locations = [
  {
    locationName: location
    failoverPriority: 0
    isZoneRedundant: false
  }
]

resource cosmosDBAccount 'Microsoft.DocumentDB/databaseAccounts@2022-05-15' = {
  name: name
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    locations: locations
    databaseAccountOfferType: 'Standard'
    publicNetworkAccess: 'Disabled'
  }
}

module privateEndpoint '../network/secure-private_endpoint.bicep' = {
  name: 'private-endpoint-${name}'
  params: {
    serviceName: name
    location: location
    tags: tags
    serviceResourceId: cosmosDBAccount.id
    subnetResourceId: subnetResourceId
    groupId: 'SQL'
  }
}

module self '../dns/secure-private_dns_zone-record.bicep' = {
  name: 'a-record-${name}-self'
  params: {
    hostname: name
    privateDnsZoneName: dnsZoneName
    ipAddress: privateEndpoint.outputs.ipAddress
  }
}

module selfRegion '../dns/secure-private_dns_zone-record.bicep' = {
  name: 'a-record-${name}-self-region'
  params: {
    hostname: '${name}-${location}'
    privateDnsZoneName: dnsZoneName
    ipAddress: privateEndpoint.outputs.inAddress2
  }
}

output privateEndpointId string = privateEndpoint.outputs.id
output privateEndpointName string = privateEndpoint.outputs.name
output privateEndpointIp string = privateEndpoint.outputs.ipAddress
