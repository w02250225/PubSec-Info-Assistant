param name string
param location string = resourceGroup().location
param tags object = {}

param kind string = ''
param sku object


// Create an App Service Plan to group applications under the same payment plan and SKU, specifically for containers
resource appServicePlan 'Microsoft.Web/serverfarms@2022-03-01' = {
  name: name
  location: location
  tags: tags
  sku: sku
  kind: kind
}

output id string = appServicePlan.id
output name string = appServicePlan.name
