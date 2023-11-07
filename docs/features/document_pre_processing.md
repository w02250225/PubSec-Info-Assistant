# Document Pre-processing
The Information Assistant relies on a multi-step process to preprocess documents in preparation for them being used in the NLP based chat interface. 
The pre-processing of documents is a crucial step as it involves several steps, such as text extraction and normalizing the text, to convert the raw data into a format that can be easily analyzed by the OpenAI model. Information Assistant preprocess different types of documents, ensuring that the text is cleaned and processed effectively for better understanding and analysis of large complex documents.

```mermaid
graph LR
  A[[File]]-->B
  AA[Document Intelligence]

  subgraph "State (Azure Blob Storage)"
  B[Upload Container]
  K{{pdf_submit_queue}}
  L{{non_pdf_submit_queue}}
  M{{image_enrichment_queue}}
  N{{media_enrichment_queue}}
  P{{pdf_polling_queue}}
  R[Logs]
  S[Contents]
  U{{text_enrichment_queue}}
  end

subgraph "Chunking"
  B-->|Blob Upload Trigger|C(FileUploadedFunc)
  C-->D{Is Text Based}
  D-->|Yes|E{File Type}
  E-->F[PDF]
  E-->G[OTHER]
  D-->|No|H{FileType}
  H-->I[Image]
  H-->J[Media]
  F-->|queue|K
  G-->|queue|L
  I-->|queue|M
  J-->|queue|N
  K-->O(FileFormRecSubmissionPDF)
  O-->|queue|P
  O-.->|submit|AA
  P-->Q(FileFormRecPollingPDF)
  Q<-.->|poll|AA
  Q & T-->|write FR layout and doc map|R
  Q & T-->|write chunks|S
  L-->T(FileLayoutParsingOther)
  Q & T-->U
  end

```

## PDF Document Pre-Processing

PDF documents often contain a mix of text, images, and other media, which requires a series of steps to extract and process the relevant information.
For PDF's we use a service, known as [Azure AI Document Intelligence](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/overview?view=doc-intel-3.1.0). Azure AI Document Intelligence 'cracks' a PDF file and process each page using the Layout API. It provides a JSON representation of the file including titles, sub-headings, headers, footers, tables and content paragraphs. We take this content and build a standardized JSON 'document map' of the content.

## Document Pre-Processing

[Unstructured.io](https://unstructured.io/) supports various document types, including 'docx', 'html', 'htm', 'csv', 'md', 'pptx', 'txt', 'json', 'xlsx', 'xml', 'eml', and 'msg'. Like Azure AI Document Intelligence for PDFs, we create a 'document map' of the content, which serves as a JSON-based representation.

## Image Pre-Processing

Image processing for 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tif', and 'tiff' formats. Leveraging Azure's GPU optionally in regions where [available](https://learn.microsoft.com/en-us/azure/container-instances/container-instances-region-availability) to generate Captions and Deep Captions. We utilize the Cognitive Services [Computer Vision API](https://azure.microsoft.com/en-us/resources/cloud-computing-dictionary/what-is-computer-vision/?ef_id=_k_f4f6deceb1b41be24ecebbf7bfa0a48b_k_&OCID=AIDcmme9zx2qiz_SEM__k_f4f6deceb1b41be24ecebbf7bfa0a48b_k_&msclkid=f4f6deceb1b41be24ecebbf7bfa0a48b#object-classification) to generate descriptions and perform OCR on any text present within these image files. A JSON model of this data is then generated the same as with other document types.

