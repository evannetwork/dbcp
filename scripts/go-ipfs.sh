# Copyright 2018 evan.network GmbH
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

ipfs config Addresses.API /ip4/127.0.0.1/tcp/5004
ipfs bootstrap rm --all
ipfs bootstrap add /ip4/18.196.143.168/tcp/4001/ipfs/QmPQCUHUqWTWyktBEHjTwiWpEKrsZa8RYtddz9ATEyJqDK
ipfs bootstrap add /ip4/18.196.211.140/tcp/4001/ipfs/Qmambifh7mAj4QVKrRE9mHXMAHLcuCuUYXvArRbim13Azv

ipfs daemon