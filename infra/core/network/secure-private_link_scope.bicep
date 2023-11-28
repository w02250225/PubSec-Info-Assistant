param name string
param location string
param tags object = {}
param workspaceName string
param appInsightsName string
param subnetResourceId string
param privateDnsZoneResourceIdMonitor string
param privateDnsZoneResourceIdOpsInsightOms string
param privateDnsZoneResourceIdOpsInsightOds string
param privateDnsZoneResourceIdAutomation string
param privateDnsZoneResourceIdBlob string
param groupId string

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2021-12-01-preview' existing = {
  name: workspaceName
}

resource appInsights 'Microsoft.Insights/components@2020-02-02-preview' existing = {
  name: appInsightsName
}

resource privateLinkScope 'microsoft.insights/privateLinkScopes@2021-07-01-preview' = {
  name: name
  location: 'global'
  tags: tags
  properties: {
    accessModeSettings: {
      queryAccessMode: 'PrivateOnly'
      ingestionAccessMode: 'PrivateOnly'
    }
  }

}

// add scoped resource for law
resource scopedResourceLaw 'Microsoft.Insights/privateLinkScopes/scopedResources@2021-07-01-preview' = {
  parent: privateLinkScope
  name: '${name}-law-connection'
  properties: {
    linkedResourceId: logAnalytics.id
  }
}

// add scope resoruce for app insights
resource scopedResourceAppInsights 'Microsoft.Insights/privateLinkScopes/scopedResources@2021-07-01-preview' = {
  parent: privateLinkScope
  name: '${name}-appInsights-connection'
  properties: {
    linkedResourceId: appInsights.id
  }
}

module privateEndpoint './secure-private_endpoint-monitor.bicep' = {
  name: 'private-endpoint-private-link-scope'
  params: {
    name: name
    location: location
    serviceResourceId: privateLinkScope.id
    subnetResourceId: subnetResourceId
    privateDnsZoneResourceIdMonitor: privateDnsZoneResourceIdMonitor
    privateDnsZoneResourceIdOpsInsightOms: privateDnsZoneResourceIdOpsInsightOms
    privateDnsZoneResourceIdOpsInsightOds: privateDnsZoneResourceIdOpsInsightOds
    privateDnsZoneResourceIdAutomation: privateDnsZoneResourceIdAutomation
    privateDnsZoneResourceIdBlob: privateDnsZoneResourceIdBlob
    groupId: groupId
  }
}
