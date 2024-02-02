param privateEndpointName string
param privateDnsZoneName string
param groupId string
param ipAddress string
param hostname string
param reusePrivateDnsZone bool = false

resource privateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' existing = {
  name: privateDnsZoneName
}

resource privateEndpoint 'Microsoft.Network/privateEndpoints@2020-06-01' existing = {
  name: privateEndpointName
}

resource dnsRecord 'Microsoft.Network/privateDnsZones/A@2020-06-01' = {
  parent: privateDnsZone
  name: hostname
  properties: {
    ttl: 3600
    aRecords: [
      {
        ipv4Address: ipAddress
      }
    ]
  }
}

resource privateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2022-05-01' = if (!reusePrivateDnsZone) {
  parent: privateEndpoint
  name: '${groupId}PrivateDnsZoneGroup'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: '${groupId}PrivateDnsZoneGroup'
        properties: {
          privateDnsZoneId: privateDnsZone.id
        }
      }
    ]
  }
}
