param name string
param location string
param tags object = {}
param dnsZoneName string
param subnetResourceIdOutbound string
param subnetResourceIdInbound string
param appServicePlanId string

resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    serverFarmId: appServicePlanId
    virtualNetworkSubnetId: subnetResourceIdOutbound
    publicNetworkAccess: 'Enabled'
  }
}

module privateEndpoint '../network/secure-private_endpoint.bicep' = {
  name: 'private-endpoint-${name}'
  params: {
    serviceName: name
    location: location
    serviceResourceId: functionApp.id
    subnetResourceId: subnetResourceIdInbound
    groupId: 'sites'
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

module scm '../dns/secure-private_dns_zone-record.bicep' = {
  name: 'a-record-${name}-scm'
  params: {
    hostname: '${name}.scm'
    groupId: privateEndpoint.outputs.groupId
    privateEndpointName: privateEndpoint.outputs.name
    privateDnsZoneName: dnsZoneName
    ipAddress: privateEndpoint.outputs.ipAddress
  }
}

output ipAddress string = privateEndpoint.outputs.ipAddress
