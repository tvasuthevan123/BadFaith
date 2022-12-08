import unittest
import requests
import azure.functions as func
import azure.cosmos as cosmos
from azure_functions import config
import os
import azure.cosmos.exceptions as exceptions
import json

class TestFunction(unittest.TestCase):

    client = cosmos.cosmos_client.CosmosClient(config.settings['db_URI'], config.settings['db_key'])
    db_client = client.get_database_client(config.settings['db_id'])
    player_container = db_client.get_container_client(config.settings['player_container'])

    def test_register_player(self):

        # Json for testing email
        # Checking for a inavlid email
        input1 = {
            'email' : "gavin@.com",
            "password" : "password1"
        }

        # Checking for a short password
        input2 = {
                'email' : "gavin@gmail.com",
                "password" : "6#?"
            }

        # Checking for a long password
        input3 = {
                'email' : "gavin@gmail.com",
                "password" : "PasswordSoLongThatItIsOverThe30CharLimit"
            }

        #Checking for a valid signup input and duplicate password
        input4 = {
                'email' : "gavin@gmail.com",
                "password" : "password2"
            }

        #invalid dictionary format
        input5 = {
                "password" : "spec4356#?"
            }

        #invalid dictionary format
        input6 = {
                'email' : "gavin@gmail.com"
            }

        
        resp = requests.get (
               #'https://comp3207cw1-ap2g20.azurewebsites.net/api/registerplayer' ,
               'http://localhost:7071/api/SignUp'   ,                   
                                                                        
                json = input6
         )



        #input1
        # Checking for a inavlid email
        # self.assertEqual(resp.json()["msg"], "Invalid email provided")

        #input2
        # Checking for a short password
        # self.assertEqual(resp.json()["msg"], "The password is less than 8 characters or more than 30 characters")
  
        #input3
        # Checking for a long password
        # self.assertEqual(resp.json()["msg"], "The password is less than 8 characters or more than 30 characters")

        #input4
        #Checking for a valid password
        # self.assertEqual(resp.json()["msg"], "OK")

        #input4 again
        #Checking for duplicate players
        # self.assertEqual(resp.json()["msg"], "An user account already exists for the email provided, please try logging in!")

        #input5 
        #Checking for missing email field in incorrectly formatted json dictionary
        # self.assertEqual(resp.json()["msg"], "No email provided")

        #input6 again
        #Checking for missing password field in incorrectly formatted json dictionary
        self.assertEqual(resp.json()["msg"], "No password provided")