param name string
param location string
param tags object = {}
param subnetResourceId string
param dnsZoneName string
param kind string = 'FormRecognizer'
param sku object = {
  name: 'S0'
}

resource account 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: name
  location: location
  kind: kind
  sku: sku
  properties: {
    customSubDomainName: name
    publicNetworkAccess: 'Disabled'
  }
}

module privateEndpoint '../network/secure-private_endpoint.bicep' = {
  name: 'private-endpoint-${name}'
  params: {
    name: name
    location: location
    tags: tags
    serviceResourceId: account.id
    subnetResourceId: subnetResourceId
    groupId: 'account'
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
