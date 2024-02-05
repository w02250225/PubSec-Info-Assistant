# IA Accelerator Secure Upgrade Feature

## What is Secure Upgrade?

Secure Upgrade moves Information Assistant into a zero-trust compliant, private network and secures access to the application using Azure Front Door with a Web Application Firewall. All Information Assistant features and capabilities remain. Prepares the architecture for network telemetry collection to support TIC 3.0.

A significant number of network-based changes are required to move Information Assistant into an Enterprise Virtual Network. 

The Secure-upgrade feature deploys

- Azure Virtual Network - 10.0.0.0/21
  - 13 Subnets - all /26
  - IP ranges are modifiable via the secure.bicep file.
- 16 private DNS zones to support all services.
- Private Link Scope for Azure Monitor.
- Azure Front Door Premium with Web Application Firewall.
- Private endpoints for all services.
  - Storage Accounts have four private endpoints; blob, file, queue, and table.
  - Private endpoints can only be assigned to a single sub-resource - e.g. blob.
- VNET integration for App Services and Functions for outbound connections from the service to all private services.
- Private link service between Azure Front Door and Front End Application Service.

The following diagram shows a high-level view of the architecture. 

![Secure Upgrade - High-level Architecture](../images/secure-upgrade-high-level-architecture)

The following table compares the original list of services of Information Assistant (22) with those as part of Secure-Upgrade (93)

| Information Assistant                                   | Information Assistant w/ Secure-Upgrade                      |
| ------------------------------------------------------- | ------------------------------------------------------------ |
| Application  Insights                                   | A Record - Private Link Service                              |
| Azure AI Search service                                 | A Record - APIM                                              |
| Azure AI services multi-service account                 | A Record - App Service                                       |
| Azure AI services multi-service account  for Enrichment | A Record - Azure AI Services                                 |
| Azure AI Video Indexer                                  | A Record - Azure Monitor                                     |
| Azure Cosmos DB account                                 | A Record - Azure Monitor / Automation                        |
| Azure OpenAI                                            | A Record - Azure Monitor / ODS                               |
| Azure Workbook Template                                 | A Record - Azure Monitor / OMS                               |
| Document intelligence                                   | A Record - Azure OpenAI                                      |
| Enrichment App Service                                  | A Record - Costmos Database                                  |
| EnrichmentApp Service plan                              | A Record - Key Vault                                         |
| Front End App Service                                   | A Record - Media Service                                     |
| Front End App Service plan                              | A Record - Storage Account / Blob                            |
| Function App                                            | A Record - Storage Account / File                            |
| Function App Service plan                               | A Record - Storage Account / Queue                           |
| Key vault                                               | A Record - Storage Account / Table                           |
| Log Analytics workspace                                 | Application Insights                                         |
| Media service                                           | Azure AI services multi-service account                      |
| Storage account                                         | Azure AI services multi-service account  for Enrichment      |
| Storage Account Event Grid System Topic                 | Azure AI Video Indexer                                       |
| Storage Account Media                                   | Azure Cosmos DB account                                      |
| Storage Account Media Event Grid System  Topic          | Azure Monitor Private Link Scope                             |
|                                                         | Azure Workbook Template                                      |
|                                                         | Document intelligence                                        |
|                                                         | Enrichment App Service                                       |
|                                                         | EnrichmentApp Service plan                                   |
|                                                         | Front Door Endpoint                                          |
|                                                         | Front Door Premium                                           |
|                                                         | Front Door WAF policy                                        |
|                                                         | Front End App Service                                        |
|                                                         | Front End App Service plan                                   |
|                                                         | Function App                                                 |
|                                                         | Function App Service plan                                    |
|                                                         | Log Analytics workspace                                      |
|                                                         | Media service                                                |
|                                                         | Network security group                                       |
|                                                         | NIC - Azure AI Multi-service account                         |
|                                                         | NIC - Azure AI Multi-service account for  Enrichment         |
|                                                         | NIC - Azure AI Search                                        |
|                                                         | NIC - Azure Monitor                                          |
|                                                         | NIC - Cosmos DB                                              |
|                                                         | NIC - Document Intelligence                                  |
|                                                         | NIC - Enrichment app service inbound                         |
|                                                         | NIC - Function app service inbound                           |
|                                                         | NIC - Media Service                                          |
|                                                         | NIC - Storage Account - Blob                                 |
|                                                         | NIC - Storage Account - File                                 |
|                                                         | NIC - Storage Account - Queue                                |
|                                                         | NIC - Storage Account - Table                                |
|                                                         | NIC - Storage Account Media - Blob                           |
|                                                         | NIC - Storage Account Media - File                           |
|                                                         | NIC - Storage Account Media - Queue                          |
|                                                         | NIC - Storage Account Media - Table                          |
|                                                         | Private DNS zone -  privatelink.agentsvc.azure-automation.net |
|                                                         | Private DNS zone -  privatelink.azure-api.net                |
|                                                         | Private DNS zone -  privatelink.azurewebsites.net            |
|                                                         | Private DNS zone -  privatelink.blob.core.windows.net        |
|                                                         | Private DNS zone -  privatelink.cognitiveservices.azure.com  |
|                                                         | Private DNS zone -  privatelink.documents.azure.com          |
|                                                         | Private DNS zone -  privatelink.file.core.windows.net        |
|                                                         | Private DNS zone -  privatelink.media.azure.net              |
|                                                         | Private DNS zone -  privatelink.monitor.azure.com            |
|                                                         | Private DNS zone -  privatelink.ods.opinsights.azure.com     |
|                                                         | Private DNS zone -  privatelink.oms.opinsights.azure.com     |
|                                                         | Private DNS zone -  privatelink.openai.azure.com             |
|                                                         | Private DNS zone -  privatelink.queue.core.windows.net       |
|                                                         | Private DNS zone -  privatelink.search.windows.net           |
|                                                         | Private DNS zone -  privatelink.table.core.windows.net       |
|                                                         | Private DNS zone -  privatelink.vault.azure.net              |
|                                                         | Private endpoint - Azure AI Multi-service  account           |
|                                                         | Private endpoint - Azure AI Multi-service  account for Enrichment |
|                                                         | Private endpoint - Azure AI Search                           |
|                                                         | Private endpoint - Azure Monitor                             |
|                                                         | Private endpoint - Cosmos DB                                 |
|                                                         | Private endpoint - Document Intelligence                     |
|                                                         | Private endpoint - Enrichment app service  inbound           |
|                                                         | Private endpoint - Function app service  inbound             |
|                                                         | Private endpoint - Media Service                             |
|                                                         | Private endpoint - Storage Account - Blob                    |
|                                                         | Private endpoint - Storage Account - File                    |
|                                                         | Private endpoint - Storage Account -  Queue                  |
|                                                         | Private endpoint - Storage Account -  Table                  |
|                                                         | Private endpoint - Storage Account Media  - Blob             |
|                                                         | Private endpoint - Storage Account Media  - File             |
|                                                         | Private endpoint - Storage Account Media  - Queue            |
|                                                         | Private endpoint - Storage Account Media  - Table            |
|                                                         | Search service                                               |
|                                                         | Smart detector alert rule                                    |
|                                                         | Storage account                                              |
|                                                         | Storage Account Event Grid System Topic                      |
|                                                         | Storage account Media                                        |
|                                                         | Storage Account Media Event Grid System  Topic               |
|                                                         | Virtual network                                              |



## Detailed Architecture

Due to the increased complexity it is important to shows more detailed views of major components of the solution. 

### Front end

The following diagram showcases end user's interaction with Information Assistant and the front end application's orchestration of the user's workflow.  Azure Front door provides a public accessible SSL secured FQDN for the user to provide in their browser. The connection along with the user's Entra ID authentication are proxied through Azure Front Door to the Front end Application service. The Front end uses VNET integration to connect to the same private network as all other services. Private DNS zones are used by the Front end application to connect with the appropriate service like:

- Azure Storage Account, blob storage to upload files.
- Azure OpenAI to submit prompts.
- Azure AI search to discovery high-quality content from the explicitly uploaded files.
- Cosmos database to view the status of uploaded files.

![Secure Upgrade - Front End Architecture](../images/secure-upgrade-front-end-architecture)



### Document Extraction, Chunking, and Embedding

![Secure Upgrade - Function App](../images/secure-upgrade-function-app)

## How to Deploy?

TBD
