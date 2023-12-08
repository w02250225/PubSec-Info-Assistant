# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

import logging
import json
import html
import minify_html
import tiktoken
from bs4 import BeautifulSoup
from datetime import datetime
from enum import Enum
import zipfile
import os
from azure.storage.blob import BlobServiceClient
from shared_code.utilities_helper import UtilitiesHelper
from nltk.tokenize import sent_tokenize
import tiktoken
import nltk
# Try to download using nltk.download
nltk.download('punkt')

punkt_dir = os.path.join(nltk.data.path[0], 'tokenizers/punkt')

# Check if the 'punkt' directory exists
if not os.path.exists(punkt_dir):
    punkt_zip_path = os.path.join(nltk.data.path[0], 'tokenizers/punkt.zip')

    # If the 'punkt.zip' file exists, unzip it
    if os.path.exists(punkt_zip_path):
        with zipfile.ZipFile(punkt_zip_path, 'r') as zip_ref:
            zip_ref.extractall(os.path.join(nltk.data.path[0], 'tokenizers/'))
    else:
        raise Exception("Failed to download 'punkt' package")

class ParagraphRoles(Enum):
    """ Enum to define the priority of paragraph roles """
    PAGE_HEADER      = 1
    TITLE           = 2
    SECTION_HEADING  = 3
    OTHER           = 3
    FOOTNOTE        = 5
    PAGE_FOOTER      = 6
    PAGE_NUMBER      = 7

class ContentType(Enum):
    """ Enum to define the types for various content chars returned from FR """
    NOT_PROCESSED           = 0
    TITLE_START             = 1
    TITLE_CHAR              = 2
    TITLE_END               = 3
    SECTIONHEADING_START    = 4
    SECTIONHEADING_CHAR     = 5
    SECTIONHEADING_END      = 6
    TEXT_START              = 7
    TEXT_CHAR               = 8
    TEXT_END                = 9
    TABLE_START             = 10
    TABLE_CHAR              = 11
    TABLE_END               = 12

class MediaType:
    """ Helper class for standard media values"""
    TEXT = "text"
    IMAGE = "image"
    MEDIA = "media"    

class Utilities:
    """ Class to hold utility functions """
    def __init__(self,
                 azure_blob_storage_account,
                 azure_blob_storage_endpoint,
                 azure_blob_drop_storage_container,
                 azure_blob_content_storage_container,
                 azure_blob_storage_key
                 ):
        self.azure_blob_storage_account = azure_blob_storage_account
        self.azure_blob_storage_endpoint = azure_blob_storage_endpoint
        self.azure_blob_drop_storage_container = azure_blob_drop_storage_container
        self.azure_blob_content_storage_container = azure_blob_content_storage_container
        self.azure_blob_storage_key = azure_blob_storage_key
        self.utilities_helper = UtilitiesHelper(azure_blob_storage_account,
                                                azure_blob_storage_endpoint,
                                                azure_blob_storage_key)

    def write_blob(self, output_container, content, output_filename, folder_set=""):
        """ Function to write a generic blob """
        # folder_set should be in the format of "<my_folder_name>/"
        # Get path and file name minus the root container
        blob_service_client = BlobServiceClient(
            self.azure_blob_storage_endpoint,
            self.azure_blob_storage_key)
        block_blob_client = blob_service_client.get_blob_client(
            container=output_container, blob=f'{folder_set}{output_filename}')
        block_blob_client.upload_blob(content, overwrite=True)

    def sort_key(self, element):
        """ Function to sort elements by page number and role priority """
        return element["page_number"]
        # to do, more complex sorting logic to cope with indented bulleted lists
        # return (element["page_number"], element["role_priority"],
        # element["bounding_region"][0]["x"], element["bounding_region"][0]["y"])

    def get_filename_and_extension(self, path):
        """ Function to return the file name & type"""
        return self.utilities_helper.get_filename_and_extension(path)
    
    def  get_blob_and_sas(self, blob_path):
        """ Function to retrieve the uri and sas token for a given blob in azure storage"""
        return self.utilities_helper.get_blob_and_sas(blob_path)

    def table_to_html(self, table):
        """ Function to take an output FR table json structure and convert to HTML """
        table_html = "<table>"
        rows = [sorted([cell for cell in table["cells"] if cell["rowIndex"] == i],
                       key=lambda cell: cell["columnIndex"]) for i in range(table["rowCount"])]
        for row_cells in rows:
            table_html += "<tr>"
            for cell in row_cells:
                tag = "td"
                if hasattr(cell, 'kind'):
                    if (cell["kind"] == "columnHeader" or cell["kind"] == "rowHeader"):
                        tag = "th"
                cell_spans = ""
                if hasattr(cell, 'columnSpan'):
                    if cell["columnSpan"] > 1:
                        cell_spans += f" colSpan={cell['columnSpan']}"
                if hasattr(cell, 'rowSpan'):
                    if cell["rowSpan"] > 1:
                        cell_spans += f" rowSpan={cell['rowSpan']}"
                table_html += f"<{tag}{cell_spans}>{html.escape(cell['content'])}</{tag}>"
            table_html +="</tr>"
        table_html += "</table>"
        return table_html

    def build_document_map_pdf(self, myblob_name, myblob_uri, result, azure_blob_log_storage_container, enable_dev_code):
        """ Function to build a json structure representing the paragraphs in a document, 
        including metadata such as section heading, title, page number, etc.
        We construct this map from the Content key/value output of FR, because the paragraphs 
        value does not distinguish between a table and a text paragraph"""

        document_map = {
            'file_name': myblob_name,
            'file_uri': myblob_uri,
            'content': result["content"],
            "structure": [],
            "content_type": [],
            "table_index": []
        }
        document_map['content_type'].extend([ContentType.NOT_PROCESSED] * len(result['content']))
        document_map['table_index'].extend([-1] * len(result["content"]))

        # update content_type array where spans are tables
        for index, table in enumerate(result["tables"]):
            start_char = table["spans"][0]["offset"]
            end_char = start_char + table["spans"][0]["length"] - 1
            document_map['content_type'][start_char] = ContentType.TABLE_START
            for i in range(start_char+1, end_char):
                document_map['content_type'][i] = ContentType.TABLE_CHAR
            document_map['content_type'][end_char] = ContentType.TABLE_END
            # tag the end point in content of a table with the index of which table this is
            document_map['table_index'][end_char] = index

        # update content_type array where spans are titles, section headings or regular content,
        # BUT skip over the table paragraphs
        for paragraph in result["paragraphs"]:
            start_char = paragraph["spans"][0]["offset"]
            end_char = start_char + paragraph["spans"][0]["length"] - 1

            # if this span has already been identified as a non textual paragraph
            # such as a table, then skip over it
            if document_map['content_type'][start_char] == ContentType.NOT_PROCESSED:
                #if not hasattr(paragraph, 'role'):
                if 'role' not in paragraph:
                    # no assigned role
                    document_map['content_type'][start_char] = ContentType.TEXT_START
                    for i in range(start_char+1, end_char):
                        document_map['content_type'][i] = ContentType.TEXT_CHAR
                    document_map['content_type'][end_char] = ContentType.TEXT_END

                elif paragraph['role'] == 'title':
                    document_map['content_type'][start_char] = ContentType.TITLE_START
                    for i in range(start_char+1, end_char):
                        document_map['content_type'][i] = ContentType.TITLE_CHAR
                    document_map['content_type'][end_char] = ContentType.TITLE_END

                elif paragraph['role'] == 'sectionHeading':
                    document_map['content_type'][start_char] = ContentType.SECTIONHEADING_START
                    for i in range(start_char+1, end_char):
                        document_map['content_type'][i] = ContentType.SECTIONHEADING_CHAR
                    document_map['content_type'][end_char] = ContentType.SECTIONHEADING_END

        # store page number metadata by paragraph object
        page_number_by_paragraph = {}
        for _, paragraph in enumerate(result["paragraphs"]):
            start_char = paragraph["spans"][0]["offset"]
            page_number_by_paragraph[start_char] = paragraph["boundingRegions"][0]["pageNumber"]

        # iterate through the content_type and build the document paragraph catalog of content
        # tagging paragraphs with title and section
        main_title = ''
        current_title = ''
        current_section = ''
        start_position = 0
        page_number = 0
        for index, item in enumerate(document_map['content_type']):

            # collect page number metadata
            page_number = page_number_by_paragraph.get(index, page_number)

            match item:
                case ContentType.TITLE_START | ContentType.SECTIONHEADING_START | ContentType.TEXT_START | ContentType.TABLE_START:
                    start_position = index
                case ContentType.TITLE_END:
                    current_title =  document_map['content'][start_position:index+1]
                    # set the main title from any title elemnts on the first page concatenated
                    if main_title == '':
                        main_title = current_title
                    elif page_number == 1:
                        main_title = main_title + "; " + current_title
                case ContentType.SECTIONHEADING_END:
                    current_section = document_map['content'][start_position:index+1]
                case ContentType.TEXT_END | ContentType.TABLE_END:
                    if item == ContentType.TEXT_END:
                        property_type = 'text'
                        output_text = document_map['content'][start_position:index+1]
                    elif item == ContentType.TABLE_END:
                        # now we have reached the end of the table in the content dictionary,
                        # write out the table text to the output json document map
                        property_type = 'table'
                        table_index = document_map['table_index'][index]
                        table_json = result["tables"][table_index]
                        output_text = self.table_to_html(table_json)
                    else:
                        property_type = 'unknown'
                    document_map["structure"].append({
                        'offset': start_position,
                        'text': output_text,
                        'type': property_type,
                        'title': main_title,
                        'subtitle': current_title,
                        'section': current_section,
                        'page_number': page_number
                    })

        del document_map['content_type']
        del document_map['table_index']

        if enable_dev_code:
            # Output document map to log container
            json_str = json.dumps(document_map, indent=2)
            file_name, file_extension, file_directory  = self.get_filename_and_extension(myblob_name)
            output_filename =  file_name + "_Document_Map" + file_extension + ".json"
            self.write_blob(azure_blob_log_storage_container, json_str, output_filename, file_directory)

            # Output FR result to log container
            json_str = json.dumps(result, indent=2)
            output_filename =  file_name + '_FR_Result' + file_extension + ".json"
            self.write_blob(azure_blob_log_storage_container, json_str, output_filename, file_directory)

        return document_map

    def num_tokens_from_string(self, string: str, encoding_name: str) -> int:
        """ Function to return the number of tokens in a text string"""
        encoding = tiktoken.get_encoding(encoding_name)
        num_tokens = len(encoding.encode(string))
        return num_tokens

    def token_count(self, input_text):
        """ Function to return the number of tokens in a text string"""
        # calc token count
        # For gpt-4, gpt-3.5-turbo, text-embedding-ada-002, you need to use cl100k_base
        encoding = "cl100k_base"
        token_count = self.num_tokens_from_string(input_text, encoding)
        return token_count

    def write_chunk(self, myblob_name, myblob_uri, file_number, chunk_size, chunk_text, page_list, 
                    section_name, title_name, subtitle_name, file_class):
        """ Function to write a json chunk to blob"""
        chunk_output = {
            'file_name': myblob_name,
            'file_uri': myblob_uri,
            'file_class': file_class,
            'processed_datetime': datetime.now().isoformat(),
            'title': title_name,
            'subtitle': subtitle_name,
            'section': section_name,
            'pages': page_list,
            'token_count': chunk_size,
            'content': chunk_text                       
        }
        # Get path and file name minus the root container
        file_name, file_extension, file_directory = self.get_filename_and_extension(myblob_name)
        blob_service_client = BlobServiceClient(
            self.azure_blob_storage_endpoint,
            self.azure_blob_storage_key)
        json_str = json.dumps(chunk_output, indent=2, ensure_ascii=False)
        block_blob_client = blob_service_client.get_blob_client(
            container=self.azure_blob_content_storage_container,
            blob=self.build_chunk_filepath(file_directory, file_name, file_extension, file_number))
        block_blob_client.upload_blob(json_str, overwrite=True)

    def build_chunk_filepath (self, file_directory, file_name, file_extension, file_number):
        """ Get the folders and filename to use when creating the new file chunks """
        folder_set = file_directory + file_name + file_extension + "/"
        output_filename = file_name + f'-{file_number}' + '.json'
        return f'{folder_set}{output_filename}'

    def build_chunks(self, document_map, myblob_name, myblob_uri, chunk_target_size):
        """ Function to build chunk outputs based on the document map """

        chunk_text = ''
        chunk_size = 0
        file_number = 0
        page_number = 0
        previous_section_name = document_map['structure'][0]['section']
        previous_title_name = document_map['structure'][0]["title"]
        previous_subtitle_name = document_map['structure'][0]["subtitle"]
        page_list = []
        chunk_count = 0

        def finalize_chunk():
            nonlocal chunk_text, chunk_count, chunk_size, file_number, page_list, page_number
            if chunk_text:  # Only write out if there is text to write
                self.write_chunk(myblob_name, myblob_uri, file_number,
                                 chunk_size, chunk_text, page_list,
                                 previous_section_name, previous_title_name, 
                                 previous_subtitle_name, MediaType.TEXT)
                chunk_count += 1
                file_number += 1  # Increment the file/chunk number
            # Reset the chunk variables
            chunk_text = ''
            chunk_size = 0
            page_list = []
            page_number = 0  # Reset the page_number for the new chunk

        for index, paragraph_element in enumerate(document_map['structure']):
            paragraph_size = self.token_count(paragraph_element["text"])
            paragraph_text = paragraph_element["text"]
            section_name = paragraph_element["section"]
            title_name = paragraph_element["title"]
            subtitle_name = paragraph_element["subtitle"]

            # Handle table paragraphs separately
            if paragraph_element["type"] == "table":
                # Check if the table needs to be split into multiple chunks
                if paragraph_size > chunk_target_size:
                    # Split the table into chunks with headers
                    table_chunks = self.chunk_table_with_headers(paragraph_text, chunk_target_size)
                    for table_chunk in table_chunks:
                        finalize_chunk()  # Finalize the previous chunk before starting a new one
                        chunk_text = minify_html.minify(table_chunk)  # Set the current chunk to the table chunk
                        chunk_size = self.token_count(chunk_text)  # Update the chunk size
                        finalize_chunk()  # Finalize the current table chunk
                    continue  # Skip to the next paragraph element

            # Check if a new chunk should be started
            if (chunk_size + paragraph_size > chunk_target_size) or \
               (section_name != previous_section_name) or \
               (title_name != previous_title_name) or \
               (subtitle_name != previous_subtitle_name):
                finalize_chunk()

            # Add paragraph to the chunk
            chunk_text += "\n" + paragraph_text
            chunk_size += paragraph_size
            if page_number != paragraph_element["page_number"]:
                page_list.append(paragraph_element["page_number"])
                page_number = paragraph_element["page_number"]

            # Update previous section, title, and subtitle
            previous_section_name = section_name
            previous_title_name = title_name
            previous_subtitle_name = subtitle_name

            # Finalize the last chunk after the loop
            if index == len(document_map['structure']) - 1:
                finalize_chunk()

        logging.info("Chunking is complete")
        return chunk_count
    
    def chunk_table_with_headers(self, table_html, chunk_target_size):
        soup = BeautifulSoup(table_html, 'html.parser')

        # Check for and extract the thead and tbody, or default to entire table
        thead = soup.find('thead')
        tbody = soup.find('tbody') or soup.find('table')
        rows = soup.find_all('tr') if not tbody else tbody.find_all('tr')

        header_html = f"<table>{minify_html.minify(str(thead))}" if thead else "<table>"
  
        # if the headers alone exceed the chunk target size
        # Just return the whole table, not much else we can do...?
        if self.token_count(header_html) > chunk_target_size:
            return [minify_html.minify(str(soup))]
              
        # Initialize chunks list and current_chunk with the header
        current_chunk = header_html
        chunks = []

        def add_current_chunk():
            nonlocal current_chunk
            # Close the table tag for the current chunk and add it to the chunks list
            if current_chunk.strip() and not current_chunk.endswith("<table>"):
                current_chunk += '</table>'
                chunks.append(current_chunk)
                # Start a new chunk with header if it exists
                current_chunk = header_html

        for row in rows:
            # If adding this row to the current chunk exceeds the target size, start a new chunk
            row_html = minify_html.minify(str(row))
            if self.token_count(current_chunk + row_html) > chunk_target_size:
                add_current_chunk()

            # Add the current row to the chunk
            current_chunk += row_html

        # Add the final chunk if there's any content left
        add_current_chunk()
        
        return chunks